// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES PREMIÈRES MINUTES (8 nov.) : src/guideDemarrage.js EXÉCUTÉ.
//  P1  compte neuf : seule l'étape « compte » est cochée, on continue par l'extension ;
//  P2  aucune étape n'est cochée sans PREUVE LUE (en cours, pas su, absente ≠ fait) ;
//  P3  compte installé : tout prouvé ⇒ `fini`, aucune étape courante (rien à afficher) ;
//  P4  « Plus tard » : l'étape (et Vinted avec l'extension) passe 7 jours, puis revient ;
//  P5  la numérotation n'est demandée qu'à un compte qui n'a jamais choisi ET dont on a
//      LU zéro N° ; le choix écrit la forme que lit `lireReglageNumeroEcrit` ;
//  P6  « Vérifier mon installation » : chaque contrôle dit son état, « pas su » n'est
//      jamais « OK », et « tout est en place » seulement si tout est lu et bon ;
//  P7  le branchement dans l'app passe les LECTURES aux preuves (pas une constante).
//  `--prouve` : rejoue l'audit sur des copies MUTÉES de la règle (une étape cochée sans
//  preuve, etc.) — chacune doit le faire échouer (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MODULE = process.env.AUDIT_PM_MODULE || path.join(RACINE, 'src', 'guideDemarrage.js');

if (process.argv.includes('--prouve')) {
  const brut = fs.readFileSync(path.join(RACINE, 'src', 'guideDemarrage.js'), 'utf8');
  const MUTATIONS = [
    ['une liste pas lue (null) cochée', "if (!Array.isArray(liste)) return 'passu';", "if (!Array.isArray(liste)) return 'fait';"],
    ['l’extension cochée pendant la question', "if (etapePont === 'demande') return 'encours';", "if (etapePont === 'demande') return 'fait';"],
    ['un nombre pas su coché', "if (typeof n !== 'number' || !Number.isFinite(n)) return 'passu';", "if (typeof n !== 'number' || !Number.isFinite(n)) return 'fait';"],
    ['un compteur de ventes illisible lu comme 0', 'return n > 0 ? n : illisible ? null : 0;', 'return n;'],
    ['une preuve absente vaut fait', "const etat = ok.has(preuves[e.cle]) ? preuves[e.cle] : 'passu';", "const etat = ok.has(preuves[e.cle]) ? preuves[e.cle] : 'fait';"],
    ['la numérotation demandée sans lecture', 'return nNum === 0;', 'return !nNum;'],
    ['« Plus tard » qui ne revient jamais', 'maintenant - t < JOURS_PLUS_TARD * 86400000', 'true'],
    ['la vérification dit OK sur un pas su', "toutVaBien: aFaire === 0 && passu === 0", 'toutVaBien: aFaire === 0'],
    ['des comptes illisibles dits reliés', "else if (!Array.isArray(comptes)) lignes.push({ cle: 'comptes', etat: 'passu'", "else if (!Array.isArray(comptes)) lignes.push({ cle: 'comptes', etat: 'ok'"],
  ];
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pm-'));
  let rates = 0;
  for (const [nom, avant, apres] of MUTATIONS) {
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; continue; }
    const f = path.join(dossier, `m${MUTATIONS.indexOf(nom) + Math.random().toString(36).slice(2, 7)}.mjs`);
    fs.writeFileSync(f, brut.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_PM_MODULE: f }, encoding: 'utf8' });
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
  const G = await import(pathToFileURL(MODULE).href);
  const N = await import(pathToFileURL(path.join(RACINE, 'src', 'numeroEcrit.js')).href);
  const etats = (g) => Object.fromEntries(g.etapes.map((e) => [e.cle, e.etat]));
  const T0 = Date.parse('2026-11-08T10:00:00Z');

  // P1
  const neuf = G.etatGuide({ compte: G.preuveCompte('u1'), extension: G.preuveExtension('absente', []), vinted: G.preuveListe([]), emails: G.preuveListe([]), vente: 'afaire' }, { maintenant: T0 });
  dit(neuf.total === 5 && neuf.faites === 1 && etats(neuf).compte === 'fait' && neuf.courante === 'extension' && !neuf.fini, 'P1 compte neuf : 1 sur 5, on continue par l’extension', neuf);
  dit(G.ETAPES_GUIDE.map((e) => e.cle).join(',') === 'compte,extension,vinted,emails,vente', 'P1 les cinq étapes, dans l’ordre');

  // P2
  dit(G.preuveCompte(undefined) === 'encours' && G.preuveCompte('') === 'passu' && G.preuveCompte(null) === 'passu', 'P2 compte : sans session, ni fait ni à faire');
  dit(G.preuveExtension('demande', []) === 'encours' && G.preuveExtension('absente', []) === 'afaire' && G.preuveExtension(undefined, undefined) === 'afaire', 'P2 extension : la question en cours ne coche rien');
  dit(G.preuveListe(undefined) === 'encours' && G.preuveListe(null) === 'passu' && G.preuveListe([]) === 'afaire' && G.preuveListe([{}]) === 'fait', 'P2 liste : trois états, cochée seulement sur une ligne lue');
  dit(G.preuveNombre(undefined) === 'encours' && G.preuveNombre(null) === 'passu' && G.preuveNombre(NaN) === 'passu' && G.preuveNombre(0) === 'afaire' && G.preuveNombre(2) === 'fait', 'P2 nombre : trois états');
  dit(G.compterVentes(undefined) === undefined && G.compterVentes(null) === null && G.compterVentes([]) === 0 && G.compterVentes([{ n: '0' }]) === 0 && G.compterVentes([{ n: null }]) === null && G.compterVentes([{ n: '' }, { n: '0' }]) === null && G.compterVentes([{ n: '3' }, { n: null }]) === 3,
    'P2 ventes : un compteur illisible ⇒ pas su, jamais 0 (une vente lue suffit)');
  for (const cle of ['compte', 'extension', 'vinted', 'emails', 'vente']) {
    for (const v of ['encours', 'passu', 'afaire', undefined, 'oui', true]) {
      const g = G.etatGuide({ compte: 'fait', extension: 'fait', vinted: 'fait', emails: 'fait', vente: 'fait', [cle]: v }, { maintenant: T0 });
      if (etats(g)[cle] === 'fait' || g.fini) { dit(false, `P2 « ${cle} » = ${String(v)} n’est jamais cochée`, g); }
    }
  }
  dit(true, 'P2 aucune étape cochée sur en cours / pas su / absente / valeur inconnue');
  const pasSu = G.etatGuide({ compte: 'fait', extension: 'fait', vinted: 'fait', emails: 'passu', vente: 'afaire' }, { maintenant: T0 });
  dit(pasSu.courante === 'emails' && etats(pasSu).emails === 'passu', 'P2 une lecture ratée reste l’étape courante (« pas pu vérifier »), sans être sautée');

  // P3
  const installe = G.etatGuide({ compte: G.preuveCompte('u1'), extension: G.preuveExtension(null, [{ vinted_user_id: '1' }]), vinted: G.preuveListe([{}]), emails: G.preuveListe([{ id: 'email_reception_x' }]), vente: G.preuveNombre(G.compterVentes([{ n: '12' }])) }, { maintenant: T0 });
  dit(installe.fini && installe.courante === null && installe.faites === 5, 'P3 compte installé : tout prouvé, rien à afficher', installe);

  // P4
  const pt = { extension: new Date(T0 - 86400000).toISOString() };
  const r1 = G.etatGuide({ compte: 'fait', extension: 'afaire', vinted: 'afaire', emails: 'afaire', vente: 'afaire' }, { plusTard: pt, maintenant: T0 });
  dit(r1.courante === 'emails' && r1.etapes[1].reportee && r1.etapes[2].reportee && etats(r1).extension === 'afaire', 'P4 « Plus tard » sur l’extension : Vinted suit, la boîte e-mail devient l’étape (rien n’est coché)', r1);
  const r2 = G.etatGuide({ compte: 'fait', extension: 'afaire', vinted: 'afaire', emails: 'afaire', vente: 'afaire' }, { plusTard: pt, maintenant: T0 + 7 * 86400000 });
  dit(r2.courante === 'extension', 'P4 sept jours après, l’étape revient', r2.courante);
  const r3 = G.etatGuide({ compte: 'fait', extension: 'fait', vinted: 'fait', emails: 'afaire', vente: 'afaire' }, { plusTard: { emails: new Date(T0).toISOString(), vente: new Date(T0).toISOString() }, maintenant: T0 });
  dit(r3.courante === null && !r3.fini, 'P4 tout ce qui reste mis de côté : rien de courant, rien de fini', r3);
  dit(!G.reporteeActive({ emails: 'n’importe quoi' }, 'emails', T0) && !G.reporteeActive(null, 'emails', T0) && !G.reporteeActive({ emails: new Date(T0 + 86400000).toISOString() }, 'emails', T0), 'P4 une date illisible ou future ne met rien de côté');

  // P5
  dit(G.numerotationAChoisir(null, 0) === true, 'P5 jamais choisi, zéro N° lu ⇒ la question');
  dit(G.numerotationAChoisir(null, undefined) === false && G.numerotationAChoisir(null, null) === false, 'P5 N° pas encore lus / pas sus ⇒ on ne demande pas');
  dit(G.numerotationAChoisir(null, 3) === false, 'P5 un vendeur qui a déjà des N° n’est jamais interrogé');
  dit(G.numerotationAChoisir({ actif: false, depuis: '2026-11-07T00:00:00Z' }, 0) === false && G.numerotationAChoisir({ choisi: 'x' }, 0) === false, 'P5 un choix déjà fait (Paramètres ou guide) ⇒ plus de question');
  const moi = N.lireReglageNumeroEcrit(G.reglageDuChoix('moi', '2026-11-08T10:00:00Z')), vrm = N.lireReglageNumeroEcrit(G.reglageDuChoix('vrm', '2026-11-08T10:00:00Z'));
  dit(moi.actif === true && vrm.actif === false && moi.depuis && vrm.depuis, 'P5 le choix écrit la forme de `vrm_numero_ecrit` (moi ⇒ allumé, VRM ⇒ éteint)', { moi, vrm });
  dit(G.CHOIX_NUMEROTATION.map((c) => c.cle).join(',') === 'vrm,moi', 'P5 deux choix : « VRM numérote » et « Je numérote moi-même »');

  // P6
  const V = (o) => G.verifierInstallation({ maintenant: T0, ...o });
  const ligne = (v, cle) => v.lignes.find((l) => l.cle === cle) || {};
  const comptes = [{ vinted_user_id: '11', login: 'alice' }, { vinted_user_id: '22', login: 'bob' }];
  const frais = { 11: T0 - 3600e3, 22: T0 - 7200e3 };
  const tout = V({ pont: { etape: 'connectee', version: '5.326.0', enRetard: false }, comptes, emails: [{ id: 'e' }], relu: frais });
  dit(tout.toutVaBien && tout.aFaire === 0 && tout.lignes.every((l) => l.etat === 'ok'), 'P6 tout lu et bon ⇒ « tout est en place »', tout);
  const abs = V({ pont: { etape: 'absente' }, comptes: [], emails: [], relu: {} });
  dit(ligne(abs, 'extension').etat === 'action' && ligne(abs, 'extension').geste?.cle === 'installer' && ligne(abs, 'comptes').geste?.cle === 'vinted' && ligne(abs, 'emails').geste?.cle === 'emails' && !ligne(abs, 'relecture').cle, 'P6 compte neuf sur ordinateur : installer, ouvrir Vinted, relier la boîte (pas de relecture sans compte)', abs);
  const tel = V({ pont: { etape: 'absente', telephone: true }, comptes, emails: [{}], relu: frais });
  dit(ligne(tel, 'extension').etat === 'ok' && tel.toutVaBien, 'P6 sur le téléphone, des comptes qui arrivent prouvent l’extension de l’ordinateur', tel);
  const telNeuf = V({ pont: { etape: 'absente', telephone: true }, comptes: [], emails: [], relu: {} });
  dit(ligne(telNeuf, 'extension').etat === 'action' && !ligne(telNeuf, 'extension').geste, 'P6 téléphone neuf : « sur ton ordinateur », aucun zip proposé ici');
  dit(ligne(V({ pont: { etape: 'connectee', version: '5.300.0', enRetard: true }, comptes, emails: [{}], relu: frais }), 'extension').geste?.cle === 'maj', 'P6 version en retard ⇒ « Mettre à jour »');
  dit(ligne(V({ pont: { etape: 'autrecompte', version: '5.326.0' }, comptes, emails: [{}], relu: frais }), 'extension').etat === 'action', 'P6 extension connectée à un autre compte VRM ⇒ à régler');
  dit(ligne(V({ pont: { etape: 'pasconnectee', version: '5.326.0' }, comptes, emails: [{}], relu: frais }), 'extension').etat === 'action', 'P6 extension pas connectée ⇒ à régler');
  const muette = V({ pont: { etape: 'muette' }, comptes: null, emails: null, relu: null });
  dit(muette.lignes.every((l) => l.etat === 'passu') && !muette.toutVaBien && muette.aFaire === 0, 'P6 rien de lisible : tout « pas su », jamais « OK » ni « à faire »', muette);
  const cours = V({ pont: { etape: 'demande' }, comptes: undefined, emails: undefined });
  dit(cours.lignes.every((l) => l.etat === 'encours') && !cours.toutVaBien, 'P6 lectures en cours : « … », jamais « OK »');
  const vieux = V({ pont: { etape: 'connectee', version: '5.326.0' }, comptes, emails: [{}], relu: { 11: T0 - 3600e3, 22: T0 - 30 * 3600e3 } });
  dit(ligne(vieux, 'relecture').etat === 'action' && /bob/.test(ligne(vieux, 'relecture').detail) && !/alice/.test(ligne(vieux, 'relecture').detail) && ligne(vieux, 'relecture').geste?.cle === 'relire', 'P6 un compte relu il y a plus de 24 h est NOMMÉ, avec le geste', ligne(vieux, 'relecture'));
  const jamais = V({ pont: { etape: 'connectee', version: '5.326.0' }, comptes, emails: [{}], relu: {} });
  dit(ligne(jamais, 'relecture').etat === 'action', 'P6 un compte jamais relu n’est pas « OK »');

  // P7
  const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
  let app = '';
  try { app = require('./_source-app.cjs').sourceApp ? require('./_source-app.cjs').sourceApp() : lire('src/App.jsx'); } catch (_) { app = lire('src/App.jsx'); }
  // (11 nov.) La carte du guide est devenue celle du parcours d'arrivée (trois étapes depuis
  // le 13 nov., lot 46) : ses preuves et ses lectures sont jugées par
  // scripts/audit-parcours-arrivee.cjs (R8). Ici, on garde ce qui reste de ce chantier :
  // la carte de Ma journée EST la carte du parcours, et ses lectures restent scalaires.
  const bloc = app.slice(app.indexOf("// ── LE PARCOURS D'ARRIVÉE, BRANCHÉ"), app.indexOf('// ── « VÉRIFIER MON INSTALLATION »'));
  dit(/<CarteParcoursApp comptes=\{props\.comptes\}/.test(app) && /preuveExtensionParcours\(pont, comptes\)/.test(bloc) && /preuveVinted\(comptes, annonces, commandes\)/.test(bloc), 'P7 la carte de Ma journée est celle du parcours, chaque preuve vient d’une lecture');
  dit(/harvest_\*_orders_\*&select=id,n:data->>nItems/.test(bloc), 'P7 les ventes se lisent en scalaire (`nItems`), jamais `select=data`');
  dit(/'vrm_parcours_plus_tard'/.test(app), 'P7 « Plus tard » est synchronisé (SYNC_KEYS)');
  const reg = lire('src/ecrans/Reglages.jsx');
  dit(/id:'verifier'[^\n]*VerifierInstallationApp/.test(reg), 'P7 Paramètres → Aide : « Vérifier mon installation »');

  console.log(ko ? `\n❌ audit premières minutes : ${ko} défaut(s)` : '\n✅ audit premières minutes : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
