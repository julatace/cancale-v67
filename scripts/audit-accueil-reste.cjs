// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT — L'ACCUEIL DES NOUVEAUX, LE RESTE (14 nov., idées 133 134 136 139 140
//  143 145 147). EXÉCUTE les vraies règles (src/accueilReste/*.js, src/numeroEcrit.js,
//  api/_lib/appel-bienvenue.js) et relit le branchement dans App.jsx :
//   N  134 — « J'ai déjà mes N° sur mes cartons » : aucun N° neuf tant qu'il n'a pas
//      répondu (et SEULEMENT pour un compte sans aucun N°) ; un N° lu porté par deux
//      annonces ⇒ rouge, rien adopté (50 annonces au même N° écrit : aucune) ; un N°
//      d'archive jamais ; un N° porté par une autre fiche jamais ; la réponse est le
//      réglage synchronisé (aucun drapeau du navigateur) ; la numérotation d'App.jsx
//      saute le N° neuf sous la retenue et le N° écrit en double ;
//   T  133 — chaque ligne = la publication de l'écran propriétaire (aucun calcul),
//      « pas su » ≠ 0, « au moins », compte neuf seulement, rangée par compte ;
//   V  136 — visite : compte neuf, une fois par écran, coupable, jamais avec un geste
//      urgent ni une feuille ; chaque bulle a ses textes (≤ 12 mots) ;
//   G  139 — chaque mot a SA phrase (≤ 22 mots), coupable ;
//   C  140 — jours 1 à 30, rangé pour la journée, coupable, écrans ouvrables ;
//   E  145 — chiffres prouvés, période d'essai lue, estimation dite avec SA règle ;
//   A  147 — lien https seulement, la même règle côté serveur, Pro seulement, projeté ;
//   O  143 — Apple prêt, ÉTEINT tant que Supabase ne l'active pas ;
//   S  les clés par compte dans SYNC_KEYS.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/(^|[^:'"`\\])\/\/\s.*$/, '$1'))).join('\n');
const MODULES = ['src/accueilReste/aides.js', 'src/accueilReste/cartonsNumeros.js', 'src/accueilReste/trouveChezToi.js', 'src/accueilReste/visiteEcrans.js', 'src/accueilReste/glossaire.js',
  'src/accueilReste/conseilDuJour.js', 'src/accueilReste/essaiBilan.js', 'src/accueilReste/appelBienvenue.js', 'src/numeroEcrit.js', 'src/accueil/tempsGagne.js', 'api/_lib/appel-bienvenue.js',
  'api/_lib/cle.js', 'api/_lib/fetch-delai.js', 'src/i18n/langues/fr/accueilReste.js'];

async function verifier(racine, { muet = false, mutation = null } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet || !bon) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 300) : ''}`); };
  // Un miroir des modules (une mutation y est appliquée) : on importe CE qui est écrit.
  const miroir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-accueil-reste-'));
  const lire = (p) => { let t = ''; try { t = fs.readFileSync(path.join(racine, p), 'utf8'); } catch (_) {} if (mutation && mutation.fichier === p) t = t.split(mutation.de).join(mutation.vers); return t; };
  for (const m of MODULES) { const t = lire(m); if (!t) continue; fs.mkdirSync(path.dirname(path.join(miroir, m)), { recursive: true }); fs.writeFileSync(path.join(miroir, m), t); }
  fs.writeFileSync(path.join(miroir, 'package.json'), '{"type":"module"}');
  const imp = async (m) => import(pathToFileURL(path.join(miroir, m)).href + '?v=' + Math.random());
  let A, K, T, V, G, C, E, P, PS, NE, FR;
  try {
    [A, K, T, V, G, C, E, P, PS, NE] = await Promise.all(['src/accueilReste/aides.js', 'src/accueilReste/cartonsNumeros.js', 'src/accueilReste/trouveChezToi.js', 'src/accueilReste/visiteEcrans.js', 'src/accueilReste/glossaire.js', 'src/accueilReste/conseilDuJour.js', 'src/accueilReste/essaiBilan.js', 'src/accueilReste/appelBienvenue.js', 'api/_lib/appel-bienvenue.js', 'src/numeroEcrit.js'].map(imp));
    FR = (await imp('src/i18n/langues/fr/accueilReste.js')).default;
  } catch (e) { dit(false, 'les règles se chargent', e.message); return ko || 1; }
  const { sourceApp } = require(path.join(RACINE, 'scripts/_source-app.cjs'));
  let app = ''; try { app = sourceApp(racine); } catch (_) { app = lire('src/App.jsx'); }
  if (mutation && mutation.fichier === 'src/App.jsx') app = app.split(mutation.de).join(mutation.vers);
  const appC = sansCom(app);
  const JOUR = 86400000, MAINT = Date.parse('2026-11-14T10:00:00Z');
  const neuf = new Date(MAINT - 2 * JOUR).toISOString(), vieux = new Date(MAINT - 90 * JOUR).toISOString();
  const nbMots = (t) => String(t || '').replace(/[«»?.:,;!()…]/g, ' ').split(/\s+/).filter(Boolean).length;

  // ── N : 134 ─────────────────────────────────────────────────────────────
  const lu = (cle) => ({ etat: 'lu', cle, source: 'description', brut: 'N° ' + cle });
  const reprenable = (k) => !/^B/i.test(String(k));
  const lignes = (items) => items.map(([id, lecture, connu = '']) => ({ id: String(id), site: 'vinted', titre: 'Nike Air Max 90 blanc taille 42', lecture, connu, presente: true, numerotable: true }));
  const ap = NE.apercuNumeroEcrit(lignes([[1, lu('12')], [2, lu('12')], [3, lu('4')], [4, lu('5')], [5, lu('B7')], [6, { etat: 'rien' }], [7, { etat: 'ambigu', cles: ['3', '8'] }]]), { reprenable });
  dit(K.retenirNumerosNeufs({ reglage: null, poolVide: true, lectures: [lu('4')], reprenable }) === true, 'N1 compte sans N°, jamais répondu, un N° écrit lu ⇒ aucun N° neuf');
  dit(K.retenirNumerosNeufs({ reglage: { actif: false, depuis: neuf }, poolVide: true, lectures: [lu('4')], reprenable }) === false, 'N2 il a déjà dit qui numérote ⇒ pas de retenue');
  dit(K.retenirNumerosNeufs({ reglage: null, poolVide: false, lectures: [lu('4')], reprenable }) === false, 'N3 un compte qui a déjà des N° (Julien) ⇒ jamais retenu');
  dit(K.retenirNumerosNeufs({ reglage: null, poolVide: true, lectures: [lu('B7'), { etat: 'rien' }], reprenable }) === false, 'N4 seulement un ancien N° (archive) ou rien d’écrit ⇒ la numérotation va comme avant');
  const pr = K.propositionCartons({ apercu: ap, reglage: null, poolVide: true, reprenable });
  dit(pr.etat === 'question', 'N5 la question est posée', pr.etat);
  dit(pr.doublons.some((d) => d.cle === '12' && d.ids.length === 2), 'N6 le N° 12 écrit sur deux annonces est montré en rouge', pr.doublons);
  dit(!pr.lus.some((l) => l.cle === '12'), 'N7 …et il n’est PAS adopté', pr.lus);
  dit(!pr.lus.some((l) => /^B/.test(l.cle)) && !K.adoptionsCartons(NE.apercuNumeroEcrit(lignes([[5, lu('B7')]])), { reprenable }).length, 'N8 un ancien N° (B…) ne se redonne jamais (même d’un aperçu qui ne l’a pas écarté)', pr.lus);
  dit(JSON.stringify(pr.lus.map((l) => [l.id, l.cle])) === JSON.stringify([['3', '4'], ['4', '5']]), 'N9 chaque N° adopté l’est pour SON annonce (par identifiant)', pr.lus);
  const ap50 = NE.apercuNumeroEcrit(lignes(Array.from({ length: 50 }, (_, i) => [100 + i, lu('7')])), { reprenable });
  dit(K.adoptionsCartons(ap50, { reprenable }).length === 0, 'N10 50 annonces identiques au même N° écrit : AUCUNE adoptée (§5 « 50 articles identiques »)');
  dit(K.adoptionsCartons(ap, { reprenable, porteurs: (k) => k === '4' }).every((l) => l.cle !== '4'), 'N11 un N° déjà porté par une autre fiche n’est pas adopté');
  dit(K.clesLuesEnDouble([lu('7'), lu('7'), lu('8')]).has('7') && !K.clesLuesEnDouble([lu('7'), lu('8')]).size, 'N12 les N° écrits en double sont repérés');
  const oui = K.reponseCartons(true, neuf), non = K.reponseCartons(false, neuf);
  dit(NE.lireReglageNumeroEcrit(oui).actif === true && NE.lireReglageNumeroEcrit(non).actif === false && K.numerotationChoisie(oui) && K.numerotationChoisie(non), 'N13 sa réponse EST le réglage synchronisé (« je numérote moi-même » ou non), jamais un drapeau local');
  dit(K.propositionCartons({ apercu: ap, reglage: oui, poolVide: true, reprenable }).etat === 'cachee' && K.propositionCartons({ apercu: ap, reglage: null, poolVide: false, reprenable }).etat === 'cachee', 'N14 répondu, ou des N° déjà donnés ⇒ plus de question');
  dit(K.propositionCartons({ apercu: ap, reglage: null, poolVide: true, reprenable, exemple: true }).etat === 'cachee', 'N15 jamais en mode exemple');
  // Le branchement : la numérotation d'App.jsx (l'effet qui donne les N°).
  const iEff = appC.indexOf('const retenueCartons = retenirNumerosNeufs(');
  const iRet = appC.indexOf('if (!num && retenueCartons) continue;');
  const iProch = appC.indexOf('if (!num) num = prochainLibre(taken, takenK, prefNum);');
  dit(iEff > 0 && iRet > iEff && iProch > iRet, 'N16 App.jsx : sous la retenue, la numérotation saute le N° NEUF (avant `prochainLibre`)');
  dit(/if \(dec\.ecrit && \(ecritsEnDouble\.has\(cleNum\(n\)\) \|\| Object\.keys\(nextNum\)\.some\(\(k\) => k !== String\(it\.id\) && nextNum\[k\] && cleNum\(nextNum\[k\]\.numero\) === cleNum\(n\)\)\)\) continue;/.test(appC), 'N17 App.jsx : « je numérote moi-même » ne pose jamais un N° écrit en double, ni un N° d’une autre fiche');
  dit(/poolVide: nextUsed\.size === 0 && taken\.size === 0 && !Object\.values\(nextNum\)\.some/.test(appC), 'N18 App.jsx : « sans aucun N° » = pool vide ET aucun N° pris ET aucune fiche numérotée');
  dit(!/localStorage\.(?:setItem|getItem)\(['"]vrm_numero_ecrit/.test(lire('src/accueilReste/AccueilReste.jsx')) && /OUTILS\.save\(CLE_NUMERO_ECRIT, reponseCartons\(/.test(lire('src/accueilReste/AccueilReste.jsx')), 'N19 la réponse passe par `save` (synchronisée), jamais par un drapeau du navigateur');

  // ── T : 133 ─────────────────────────────────────────────────────────────
  const pubs = { sansNumero: { n: 3, at: MAINT - 60e3 }, colisAposter: { enRetard: 2, total: 5, at: MAINT - 60e3 }, urssafMois: { aDater: { n: 4, ca: 120 }, at: MAINT - 3600e3 } };
  const r = T.lignesTrouve({ ...pubs, maintenant: MAINT });
  const n = (c) => r.lignes.find((l) => l.cle === c).n;
  dit(n('colis-retard') === 2 && n('ventes-a-dater') === 4 && n('sans-numero') === 3 && r.total === 9 && !r.partiel, 'T1 chaque ligne est le nombre PUBLIÉ (Colis, Ventes, Annonces), sommé', r.lignes);
  const r2 = T.lignesTrouve({ ...pubs, colisAposter: { enRetard: 2, at: MAINT - 13 * 3600e3 }, urssafMois: null, maintenant: MAINT });
  dit(r2.lignes.find((l) => l.cle === 'colis-retard').n === null && r2.lignes.find((l) => l.cle === 'ventes-a-dater').n === undefined && r2.partiel && r2.total === 3, 'T2 publication trop vieille ⇒ « pas su » (null), absente ⇒ en attente — jamais 0 ; le total dit « au moins »');
  dit(r.lignes.find((l) => l.cle === 'sans-numero').geste.vue === 'nonum' && T.lignesTrouve({ ...pubs, cartons: true, maintenant: MAINT }).lignes.find((l) => l.cle === 'sans-numero').geste.cle === 'cartons', 'T3 le geste de chaque ligne : la vue « Sans numéro », ou la question des cartons quand elle est posée');
  dit(T.carteTrouve(r, { reglage: null, creeLe: neuf, pret: true, maintenant: MAINT }) === 'liste' && T.carteTrouve(r, { reglage: null, creeLe: vieux, pret: true, maintenant: MAINT }) === 'cachee', 'T4 un compte NEUF seulement (un vendeur installé n’est jamais interrompu)');
  dit(T.carteTrouve(r, { reglage: A.noterTrouveVu(null, neuf), creeLe: neuf, pret: true, maintenant: MAINT }) === 'cachee' && T.carteTrouve(r, { reglage: null, creeLe: neuf, pret: false, maintenant: MAINT }) === 'cachee', 'T5 « C’est noté » la range (par compte) ; pas avant la fin de l’import');
  const zero = T.lignesTrouve({ sansNumero: { n: 0, at: MAINT }, colisAposter: { enRetard: 0, at: MAINT }, urssafMois: { aDater: { n: 0 }, at: MAINT }, maintenant: MAINT });
  dit(T.carteTrouve(zero, { reglage: null, creeLe: neuf, pret: true, maintenant: MAINT }) === 'rien' && T.carteTrouve(r2.lignes.every((l) => !Number.isInteger(l.n) || l.n === 0) ? r2 : T.lignesTrouve({ maintenant: MAINT }), { reglage: null, creeLe: neuf, pret: true, maintenant: MAINT }) === 'attente', 'T6 tout est su et vaut 0 ⇒ « rien à régler » ; rien de su ⇒ aucune carte vide');
  dit(T.importPret({ a: { etat: 'encours' } }, true) === false && T.importPret({ a: { etat: 'fini' } }, false) === true && T.importPret({ a: null }, true) === true && T.importPret(null, false) === false, 'T7 « juste après l’import » : en cours ⇒ pas encore, fini ⇒ oui, sans import ⇒ le dressing lu');
  const srcT = sansCom(lire('src/accueilReste/trouveChezToi.js'));
  dit(!/my_orders|transaction_id|status_title|needsBordereau|aExpedier\(/.test(srcT), 'T8 aucune vente relue ici : la règle consomme les publications');
  dit(/publierSansNumero\(localStorage, AUTH\.user && AUTH\.user\.id, annStats\.sansNum\)/.test(appC), 'T9 « sans N° » est publié par Annonces avec le nombre même de la grille (`annStats.sansNum`)');
  dit(/prendreVue\('nonum'\)\) setAnnSort\('nonum'\)/.test(appC), 'T10 le geste « Voir » ouvre la vue « Sans numéro »');

  // ── V : 136 ─────────────────────────────────────────────────────────────
  dit(V.visiteAuto(null, 'annonces', { creeLe: neuf, maintenant: MAINT }) === true, 'V1 compte neuf, écran jamais visité ⇒ la visite part');
  dit(V.visiteAuto(A.noterVisiteVue(null, 'annonces'), 'annonces', { creeLe: neuf, maintenant: MAINT }) === false, 'V2 vue (passée ou finie) ⇒ plus jamais seule');
  dit(V.visiteAuto(A.basculerAide(null, 'visite', false), 'annonces', { creeLe: neuf, maintenant: MAINT }) === false, 'V3 coupée dans Paramètres ⇒ rien');
  dit(V.visiteAuto(null, 'annonces', { creeLe: neuf, maintenant: MAINT, urgent: true }) === false, 'V4 JAMAIS au-dessus d’un geste urgent');
  dit(V.visiteAuto(null, 'annonces', { creeLe: neuf, maintenant: MAINT, feuilleOuverte: true }) === false && V.visiteAuto(null, 'annonces', { creeLe: neuf, maintenant: MAINT, arrivee: true }) === false, 'V5 ni sur une feuille ouverte, ni pendant la visite d’arrivée');
  dit(V.visiteAuto(null, 'annonces', { creeLe: vieux, maintenant: MAINT }) === false && V.visiteAuto(null, 'annonces', { creeLe: 'illisible', maintenant: MAINT }) === false, 'V6 un vendeur installé (ou date illisible) n’est jamais interrompu');
  const elUrgent = { getBoundingClientRect: () => ({ width: 100, height: 20 }) };
  dit(V.gesteUrgent({ querySelectorAll: (s) => (/data-urgent="1"/.test(s) ? [elUrgent] : []) }) === true && V.gesteUrgent({ querySelectorAll: () => [] }) === false, 'V7 un onglet urgent à l’écran est vu');
  dit(V.ECRANS_VISITE.length === 4, 'V8 quatre écrans visités', V.ECRANS_VISITE);
  const manque = []; const long = [];
  for (const e of V.ECRANS_VISITE) for (const s of V.ETAPES_ECRANS[e]) { for (const k of [V.cleTitre(e, s.cle), V.cleTexte(e, s.cle)]) if (!FR[k]) manque.push(k); if (nbMots(FR[V.cleTexte(e, s.cle)]) > 12) long.push(V.cleTexte(e, s.cle)); }
  dit(!manque.length, 'V9 chaque bulle a son titre et sa phrase (5 langues : audit-traduction)', manque);
  dit(!long.length, 'V10 une phrase de bulle : 12 mots au plus', long);
  dit(/<VisiteEcranHote tab=\{tab\}/.test(appC) && /!bienvenue && !configOuverte && !parcoursOuvert && !visite \? <GardeEcran nom="visite-ecran"><VisiteEcranHote/.test(appC), 'V11 la coque monte la visite des écrans, jamais avec l’arrivée');
  dit(/<RevoirVisite cle=\{cle\}/.test(lire('src/composants/AideEcran.jsx')), 'V12 rejouable depuis le « ? » de l’écran');

  // ── G : 139 ─────────────────────────────────────────────────────────────
  const gm = G.MOTS_GLOSSAIRE.filter((m) => !FR[G.cleMot(m)] || !FR[G.cleDef(m)]);
  dit(!gm.length && ['versement', 'aretirer', 'numero'].every((m) => G.estMot(m)), 'G1 « versement », « à retirer », « N° » (et les autres) ont leur mot et leur phrase', gm);
  dit(G.MOTS_GLOSSAIRE.every((m) => nbMots(FR[G.cleDef(m)]) <= G.MOTS_MAX_DEF), 'G2 une phrase chacun (≤ 22 mots)', G.MOTS_GLOSSAIRE.map((m) => [m, nbMots(FR[G.cleDef(m)])]).filter((x) => x[1] > 22));
  dit(A.aideActive(null, 'glossaire', { creeLe: vieux, maintenant: MAINT }) === true && A.aideActive(A.basculerAide(null, 'glossaire', false), 'glossaire', { creeLe: neuf }) === false, 'G3 le mot ne s’ouvre qu’au toucher (allumé pour tous) ; coupé ⇒ plus de bulle');

  // ── C : 140 ─────────────────────────────────────────────────────────────
  const jour = (j) => new Date(MAINT - (j - 1) * JOUR - 3600e3).toISOString();
  const c1 = C.conseilDuJour(null, { creeLe: jour(1), maintenant: MAINT }), c30 = C.conseilDuJour(null, { creeLe: jour(30), maintenant: MAINT }), c31 = C.conseilDuJour(null, { creeLe: jour(31), maintenant: MAINT });
  dit(c1 && c1.n === 1 && c30 && c30.n === 30 && c31 === null, 'C1 un conseil par jour, du 1er au 30e, puis plus rien', [c1, c30, c31]);
  dit(C.conseilDuJour(A.fermerConseil(null, C.jourLocal(MAINT)), { creeLe: jour(3), maintenant: MAINT }) === null && !!C.conseilDuJour(A.fermerConseil(null, C.jourLocal(MAINT)), { creeLe: jour(3), maintenant: MAINT + JOUR }), 'C2 « × » le range pour aujourd’hui ; demain le suivant revient');
  dit(C.conseilDuJour(A.basculerAide(null, 'conseil', false), { creeLe: jour(3), maintenant: MAINT }) === null && C.conseilDuJour(null, { creeLe: '', maintenant: MAINT }) === null && C.conseilDuJour(null, { creeLe: jour(3), maintenant: MAINT, exemple: true }) === null, 'C3 coupé, date illisible, mode exemple ⇒ rien');
  const mOng = /const ONGLETS_LIENS=\[([^\]]*)\]/.exec(app);
  const onglets = new Set(mOng ? [...mOng[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : []);
  { const arg = lire('src/argent.js'); const m = /CHEMINS_ARGENT = Object\.freeze\(\{([\s\S]*?)\}\)/.exec(arg); if (m) for (const x of m[1].matchAll(/^\s*([a-z_]+):/gm)) onglets.add(x[1]); }
  const horsTab = C.CONSEILS.filter((c) => c.tab && !onglets.has(c.tab));
  dit(C.CONSEILS.length === 30 && !horsTab.length, 'C4 30 conseils, chacun mène à un écran que `?tab=` sait ouvrir', horsTab);
  dit(C.CONSEILS.every((c) => FR[C.cleConseil(c.n)] && nbMots(FR[C.cleConseil(c.n)]) <= 20), 'C5 chaque conseil a son texte (≤ 20 mots)', C.CONSEILS.map((c) => [c.n, nbMots(FR[C.cleConseil(c.n)])]).filter((x) => !(x[1] <= 20)));
  const iJobs = appC.indexOf('ordreJournee(\'bas\', persoJ)'), iAR = appC.indexOf('<AccueilResteJournee');
  dit(iAR > 0 && iJobs > iAR && appC.lastIndexOf('jobs.length===0', iAR) > 0, 'C6 Ma journée : les cartes de l’accueil sont SOUS les gestes du jour (jamais au-dessus)');

  // ── E : 145 ─────────────────────────────────────────────────────────────
  const fin = new Date(MAINT + 5 * JOUR).toISOString();
  const abo = { statut: 'trialing', finEssai: fin };
  const imprimes = { a: new Date(MAINT - JOUR).toISOString(), b: new Date(MAINT - 1.5 * JOUR).toISOString(), vieux: new Date(MAINT - 20 * JOUR).toISOString(), sansDate: true };
  const suivis = [{ suivi: '31415926', at: new Date(MAINT - JOUR).toISOString() }, { suivi: '3141-5926', at: new Date(MAINT - JOUR / 2).toISOString() }, { suivi: 'VGS27182818', at: new Date(MAINT - 2 * JOUR).toISOString() }, { suivi: '99999999', at: new Date(MAINT - 30 * JOUR).toISOString() }];
  const b = E.bilanEssai({ abo, imprimes, suivis, maintenant: MAINT });
  dit(b && b.restants === 5 && b.bordereaux === 2 && b.colis === 2, 'E1 jours restants, bordereaux imprimés et colis suivis DANS l’essai (doublons de n° réunis, hors période écartés)', b);
  dit(E.SECONDES_PAR.bordereau === 100 && E.SECONDES_PAR.colis === 50 && b.minutes === 5, 'E2 « temps gagné » : les durées de référence de la page d’accueil (100 s, 50 s), arrondies — dit « estimé »', [E.SECONDES_PAR, b.minutes]);
  dit(E.bilanEssai({ abo: { statut: 'active', finEssai: fin }, imprimes, suivis, maintenant: MAINT }) === null && E.bilanEssai({ abo: null, imprimes, suivis }) === null, 'E3 pas en essai, ou pas su ⇒ aucune carte');
  const bp = E.bilanEssai({ abo, imprimes, suivis: null, maintenant: MAINT });
  dit(bp.colis === null && bp.partiel === true && bp.minutes === E.arrondiMinutes(2 * 100), 'E4 une lecture ratée ⇒ « — » et « au moins », jamais 0');
  dit(/essai\.estime/.test(lire('src/accueilReste/AccueilReste.jsx')) && /estimation/i.test(FR['essai.regle']) && /\{b\}/.test(FR['essai.regle']), 'E5 la carte dit « estimé » et sa règle (repli « Comment c’est estimé »)');
  dit(/select=suivi:meta->>suivi,at:meta->>receivedAt/.test(lire('src/accueilReste/AccueilReste.jsx')), 'E6 les colis suivis sont lus PROJETÉS (jamais `select=data`)');

  // ── A : 147 ─────────────────────────────────────────────────────────────
  const bons = ['https://calendly.com/julien/15min', 'https://cal.com/julien/bienvenue?x=1'];
  const mauvais = ['', 'http://calendly.com/x', 'javascript:alert(1)', 'https://127.0.0.1/x', 'https://localhost/x', 'https://u:p@calendly.com/x', 'https://calendly.com:8443/x', 'https://cal endly.com/x', 'https://x.local/y', 'https://' + 'a'.repeat(310) + '.com'];
  dit(bons.every((u) => P.lienReservation(u) && PS.lienReservation(u)) && mauvais.every((u) => !P.lienReservation(u) && !PS.lienReservation(u)), 'A1 un lien https vers un hôte public seulement (des deux côtés)', mauvais.filter((u) => P.lienReservation(u) || PS.lienReservation(u)));
  const bloc = (t) => { const m = /<appel-lien-regle>[^\n]*\n([\s\S]*?)\/\/ <\/appel-lien-regle>/.exec(t); return m ? m[1] : null; };
  dit(bloc(lire('src/accueilReste/appelBienvenue.js')) && bloc(lire('src/accueilReste/appelBienvenue.js')) === bloc(lire('api/_lib/appel-bienvenue.js')), 'A2 la règle du lien est la MÊME dans l’app et le serveur');
  dit(P.appelVisible({ plan: 'pro', appelBienvenue: bons[0] }) === bons[0] && P.appelVisible({ plan: 'solo', appelBienvenue: bons[0] }) === '' && P.appelVisible({ plan: 'pro', proprietaire: true, appelBienvenue: bons[0] }) === '' && P.appelVisible({ plan: 'pro', appelBienvenue: '' }) === '', 'A3 un compte Pro seulement ; champ vide ⇒ rien n’apparaît');
  const appels = [];
  const fetcher = async (u) => { appels.push(u); return { ok: true, json: async () => [{ l: bons[0] }] }; };
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'eyJservice' };
  const proprio = '7a1e0c55-2b1d-4c3e-9f00-0000000000aa';
  const lienSolo = await PS.lienAppelPour({ plan: 'solo', proprio, env, fetcher });
  const lienPro = await PS.lienAppelPour({ plan: 'pro', proprio, env, fetcher });
  dit(lienSolo === '' && appels.length === 1 && lienPro === bons[0], 'A4 le serveur ne lit le lien que pour un compte Pro', { lienSolo, lienPro, n: appels.length });
  dit(/owner=eq\.7a1e0c55-2b1d-4c3e-9f00-0000000000aa&id=eq\.main&select=l:data->vrm_appel_bienvenue->>lien/.test(appels[0] || '') && !/select=data(&|$)/.test(appels[0] || ''), 'A5 …dans la ligne `main` du PROPRIÉTAIRE, projetée (jamais `select=data`)', appels[0]);
  dit(await PS.lienAppelPour({ plan: 'pro', proprio, env: { SUPABASE_URL: env.SUPABASE_URL }, fetcher }) === '' && await PS.lienAppelPour({ plan: 'pro', proprio, env, fetcher: async () => { throw new Error('x'); } }) === '' && await PS.lienAppelPour({ plan: 'pro', proprio, env, fetcher: async () => ({ ok: true, json: async () => [{ l: 'javascript:alert(1)' }] }) }) === '', 'A6 pas de clé, panne, lien refusé ⇒ rien');
  const compte = sansCom(lire('api/compte.js'));
  dit(/const appelBienvenue = plan === PLAN_PRO && !acc\.proprietaire \? await lienAppelPour\(/.test(compte) && /\n\s*appelBienvenue,\n/.test(compte), 'A7 api/compte.js (mode=abonnement) rend le lien au plan LU chez Stripe, propriétaire exclu');
  dit((fs.readdirSync(path.join(racine, 'api')).filter((f) => f.endsWith('.js')).length) <= 12, 'A8 toujours 12 fonctions api/ au plus');

  // ── O : 143 ─────────────────────────────────────────────────────────────
  const mProv = /const OAUTH_PROVIDERS = \[([\s\S]*?)\];/.exec(appC);
  dit(mProv && /id: 'apple',\s*label: 'Apple'/.test(mProv[1]), 'O1 « Continuer avec Apple » est prêt (OAUTH_PROVIDERS)');
  dit(/const providerEnabled = \(id\) => AUTH_SETTINGS\?\.external\?\.\[id\]===true;/.test(appC) && /OAUTH_PROVIDERS\.filter\(p => providerEnabled\(p\.id\)\)/.test(appC), 'O2 …et ÉTEINT : un bouton n’existe que si Supabase dit le fournisseur activé');
  { const AUTH_SETTINGS = { external: { google: true, discord: false } }; const providerEnabled = (id) => AUTH_SETTINGS?.external?.[id] === true;
    const liste = [{ id: 'google' }, { id: 'discord' }, { id: 'apple' }].filter((p) => providerEnabled(p.id)).map((p) => p.id);
    dit(JSON.stringify(liste) === '["google"]', 'O3 Apple non activé chez Supabase ⇒ aucun bouton Apple', liste); }
  dit(/\['google','discord','apple'\]\.some\(id=>j\.external\[id\]!==undefined&&typeof j\.external\[id\]!=='boolean'\)/.test(appC), 'O4 un réglage Apple illisible chez Supabase fait refuser la réponse (rien proposé sur un doute)');
  dit(/provider==='apple'\?\['appleid\.apple\.com'\]/.test(lire('src/auth/liaisonOAuth.js')), 'O5 « Relier Apple » ne suit qu’un retour vers appleid.apple.com');

  // ── S : par compte ──────────────────────────────────────────────────────
  const mSync = /const SYNC_KEYS = \[([\s\S]*?)\n\];/.exec(appC);
  dit(mSync && /CLE_AIDES, CLE_APPEL,/.test(mSync[1]) && A.CLE_AIDES === 'vrm_aides_accueil' && P.CLE_APPEL === 'vrm_appel_bienvenue', 'S1 les aides (et le lien de l’appel) sont rangées PAR COMPTE, synchronisées');
  dit(!/localStorage\.setItem/.test(sansCom(lire('src/accueilReste/deps.js')) + sansCom(lire('src/accueilReste/aides.js'))), 'S2 aucune aide ne s’écrit dans le navigateur seul');
  try { fs.rmSync(miroir, { recursive: true, force: true }); } catch (_) {}
  return ko;
}

const MUTATIONS = [
  { nom: 'la retenue disparaît (un N° neuf donné par-dessus ses cartons)', fichier: 'src/App.jsx', de: 'if (!num && retenueCartons) continue;', vers: '' },
  { nom: 'un N° écrit en double est adopté', fichier: 'src/accueilReste/cartonsNumeros.js', de: '    if (double.has(String(l.lu))) continue;\n', vers: '' },
  { nom: 'un ancien N° (B…) est redonné', fichier: 'src/accueilReste/cartonsNumeros.js', de: '    if (!reprenable(l.lu)) continue;\n', vers: '' },
  { nom: 'la retenue vise aussi un compte qui a déjà des N°', fichier: 'src/accueilReste/cartonsNumeros.js', de: 'if (poolVide !== true) return false;', vers: '' },
  { nom: 'la numérotation écrite pose un N° en double', fichier: 'src/App.jsx', de: 'if (dec.ecrit && (ecritsEnDouble.has(cleNum(n))', vers: 'if (false && (ecritsEnDouble.has(cleNum(n))' },
  { nom: '« pas su » devient 0', fichier: 'src/accueilReste/trouveChezToi.js', de: "? { n: null, raison: 'ancien' }", vers: "? { n: 0, raison: 'ancien' }" },
  { nom: 'la carte « trouvé » chez un vendeur installé', fichier: 'src/accueilReste/trouveChezToi.js', de: "if (!compteNeuf(creeLe, maintenant)) return 'cachee';", vers: '' },
  { nom: 'la visite part sur un geste urgent', fichier: 'src/accueilReste/visiteEcrans.js', de: 'if (feuilleOuverte || arrivee || urgent) return false;', vers: 'if (feuilleOuverte || arrivee) return false;' },
  { nom: 'la visite ne se range pas', fichier: 'src/accueilReste/visiteEcrans.js', de: 'if (lireAides(reglage).vues[ecran]) return false;', vers: '' },
  { nom: 'un vendeur installé reçoit visite et conseil', fichier: 'src/accueilReste/aides.js', de: 'return j != null && j <= JOURS_NEUF;', vers: 'return j != null;' },
  { nom: 'le conseil fermé revient le jour même', fichier: 'src/accueilReste/conseilDuJour.js', de: 'if (r.conseil && r.conseil.ferme && r.conseil.jour === jourLocal(maintenant)) return null;', vers: '' },
  { nom: 'un bordereau hors de l’essai compte', fichier: 'src/accueilReste/essaiBilan.js', de: 't >= debut && t <= fin) n++;', vers: 't <= fin) n++;' },
  { nom: 'des colis lus ratés valent 0', fichier: 'src/accueilReste/essaiBilan.js', de: 'if (!Array.isArray(lignes)) return null;', vers: 'if (!Array.isArray(lignes)) return 0;' },
  { nom: 'le lien http passe', fichier: 'src/accueilReste/appelBienvenue.js', de: "if (u.protocol !== 'https:' ||", vers: "if (false ||" },
  { nom: 'le serveur lit le lien pour un compte Solo', fichier: 'api/_lib/appel-bienvenue.js', de: "if (plan !== 'pro' || proprietaire === true) return '';", vers: '' },
  { nom: 'le lien rendu à tout le monde', fichier: 'src/accueilReste/appelBienvenue.js', de: "abo.plan !== 'pro'", vers: 'false' },
  { nom: 'Apple montré sans être activé', fichier: 'src/App.jsx', de: 'OAUTH_PROVIDERS.filter(p => providerEnabled(p.id))', vers: 'OAUTH_PROVIDERS.filter(p => true)' },
  { nom: 'les aides ne sont plus par compte', fichier: 'src/App.jsx', de: '  CLE_AIDES, CLE_APPEL,', vers: '' },
  { nom: 'le glossaire ne se coupe plus', fichier: 'src/accueilReste/aides.js', de: "if (!AIDES.includes(aide) || r.off[aide]) return false;", vers: 'if (!AIDES.includes(aide)) return false;' },
];

(async () => {
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    console.log('— l’audit doit être VERT sur le code tel quel —');
    const base = await verifier(RACINE, { muet: true });
    console.log(base ? `KO  ${base} rouge(s) sans mutation` : 'OK  vert sans mutation');
    for (const m of MUTATIONS) {
      const k = await verifier(RACINE, { muet: true, mutation: m });
      if (k) rouges++;
      console.log(`${k ? 'OK  rouge' : 'KO  reste VERT'} sous la mutation « ${m.nom} »${k ? ` (${k})` : ''}`);
    }
    const ok = !base && rouges === MUTATIONS.length;
    console.log(ok ? `\n✅ ${rouges}/${MUTATIONS.length} mutations rougissent l’audit` : `\n❌ ${MUTATIONS.length - rouges} mutation(s) passent inaperçues`);
    process.exit(ok ? 0 : 1);
  }
  const ko = await verifier(process.env.AUDIT_RACINE || RACINE);
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ accueil (le reste) : tout est vert');
  process.exit(ko ? 1 : 0);
})();
