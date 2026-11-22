// ════════════════════════════════════════════════════════════════════════════
//  MA JOURNÉE COURTE ET STATISTIQUES · PILOTAGE ET FINANCES — LES RÈGLES, EXÉCUTÉES (21 nov., lot journee-stats).
//  Julien : « bénéfice dans Ma journée — brut et net du mois, et d'aujourd'hui, les mêmes chiffres que Comptabilité » ;
//  « je veux que tu proposes beaucoup plus de statistiques […] de la vraie data » ; « toute l'application doit être
//  simplifiée et ergonomique ». Récit : docs/passation/2026-11-21-journee-stats.md.
//
//  Ce script EXÉCUTE src/aujourdhui/pilotage.js (avec src/aujourdhui/modele.js et src/accueil/tempsGagne.js, copiés tels
//  quels dans un dossier temporaire) sur des données INVENTÉES :
//    U  UNE SOURCE PAR CHIFFRE : chaque nombre de Statistiques est celui que rend son propriétaire (`valeur` = la forme de
//       `valeurChiffre`) pour la MÊME fenêtre — jamais recalculé à côté ; le brut et le net de Ma journée sont `brut` et
//       `benefice` du propriétaire, pas un mélange ; un « pas su » reste null (jamais 0) ;
//    F  les fenêtres 7 · 30 · 90 j : aujourd'hui compris, N jours entiers ;
//    G  les gestes de VRM : seulement les ACCEPTÉS, d'un type de VRM, l'heure en millisecondes (la forme de la route) ;
//    T  le temps gagné : la durée de RÉFÉRENCE de chaque type (src/accueil/tempsGagne.js), un type sans durée ne compte pas
//       et c'est dit (« k sur n ») ;
//    S  la série d'activité : jours d'affilée jusqu'à aujourd'hui (ou hier) ;
//    V  favoris → ventes : PAR IDENTITÉ (identifiant d'annonce du message = celui de la transaction), dans les 14 jours
//       après le message ; une vente au même titre mais d'une autre annonce ne compte pas ; ventes pas reliées ⇒ null ;
//    E  les écrans : aucune règle dans StatsPilotage.jsx (ni somme, ni moyenne, ni import de statsVentes).
//  Preuve par mutation : `MUTATION=<nom>` réaffaiblit une règle ⇒ rouge (`MUTATION=liste`).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const FICHIERS = { pilotage: 'src/aujourdhui/pilotage.js', modele: 'src/aujourdhui/modele.js', temps: 'src/accueil/tempsGagne.js', transp: 'src/statsTransporteurs.js' };

const MUTATIONS = {
  fenetre_sans_auj: ['pilotage', (s) => s.replace("fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1);", "fin.setHours(0, 0, 0, 0);")],
  gestes_refuses: ['modele', (s) => s.replace("e && e.resultat === 'ok' && TYPES_VRM.includes(e.type)", "e && TYPES_VRM.includes(e.type)")],
  temps_devine: ['temps', (s) => s.replace("if (!g) return null;", "if (!g) return 60;")],
  serie_avec_trou: ['pilotage', (s) => s.replace("while (n < 400 && actif(d)) {", "while (n < 400 && (actif(d) || n === 2)) {")],
  favori_sans_identite: ['pilotage', (s) => s.replace("if (!it || !premier.has(String(it))) continue;", "if (!it) continue; if (!premier.has(String(it))) premier.set(String(it), 0);")],
  favori_delai_infini: ['pilotage', (s) => s.replace("ts <= t0 + DELAI_FAVORI_VENTE_J * JOUR", "true")],
  favori_passu_zero: ['pilotage', (s) => s.replace("annonces: new Set(relies.map((m) => m.item)).size, ventes: null, taux: null };", "annonces: new Set(relies.map((m) => m.item)).size, ventes: 0, taux: 0 };")],
  vendu_recalcule: ['pilotage', (s) => s.replace("const chiffres = statsPeriodes({ valeur: (id, k) => valeur(id, P[k] || k), periodes: [cle], raisonCourte })[cle];",
    "const chiffres = statsPeriodes({ valeur: (id, k) => { const x = valeur(id, P[k] || k); return id === 'vendu' && x && x.valeur != null ? { ...x, valeur: Math.round(x.valeur) } : x; }, periodes: [cle], raisonCourte })[cle];")],
  net_zero: ['modele', (s) => s.replace("const net = { valeur: lu(Nt) ? Nt.valeur : null,", "const net = { valeur: lu(Nt) ? Nt.valeur : 0,")],
  net_du_brut: ['modele', (s) => s.replace("const Nt = valeur('benefice', p) || {};", "const Nt = valeur('brut', p) || {};")],
  brut_au_moins: ['modele', (s) => s.replace("{ ...brut, partiel: true, couverture: brut.couverture || `${Br.n}/${ventes.valeur}` }", "{ ...brut, partiel: false, couverture: '' }")],
  panier_partiel: ['modele', (s) => s.replace("const entier = (x) => x.valeur != null && !x.partiel;", "const entier = (x) => x.valeur != null;")],
  heure_iso_seule: ['modele', (s) => s.replace("const n = typeof at === 'number' ? at : /^\\d+$/.test(String(at)) ? Number(at) : Date.parse(String(at));", "const n = Date.parse(String(at));")],
  // (reprise) « N sur 3 automatisations » : la règle de Paramètres (src/automatisationsEtat.js), jamais un nombre posé.
  auto_devine: ['app', (s) => s.replace("{ n: automatisationsActives(load), sur: AUTOMATISATIONS_COMPTEES }", "{ n: 3, sur: 3 }")],
  // (21 nov.) Transporteurs : chaque délai sur des dates LUES, « — » sous 3 colis, médiane si écarts forts, inconnu à part.
  transp_date_devinee: ['transp', (s) => s.replace("const depotAt = d ? ms(d.priseAt) : null;", "const depotAt = d ? ms(d.priseAt) : (ms(venteAt) != null ? ms(venteAt) + 86400000 : null);")],
  transp_moins_de_3: ['transp', (s) => s.replace("if (n < MIN_COLIS) return { jours: null, mode: null, n, sur };", "if (n < 1) return { jours: null, mode: null, n, sur };")],
  transp_toujours_moyenne: ['transp', (s) => s.replace("const x = fort ? med : moy;", "const x = moy;")],
  transp_inconnu_fondu: ['transp', (s) => s.replace(".filter(([k]) => k !== 'pas-lu')", "")],
  transp_retard_estime: ['transp', (s) => s.replace("retard: depotAt != null && lim != null ? depotAt > lim : null,", "retard: depotAt != null ? depotAt > (lim != null ? lim : (ms(venteAt) || 0) + 7 * 86400000) : null,")],
  transp_retire_livre: ['transp', (s) => s.replace("(d.etat === 'disponible' || d.etat === 'livre')", "(d.etat === 'disponible' || d.etat === 'livre' || d.etat === 'retire')")],
  transp_fenetre_ignoree: ['transp', (s) => s.replace("const F = L.filter((x) => dans(dateDe(x)));", "const F = L.slice();")],
  vue_transp_calcule: ['vueT', (s) => s.replace("const PRINCIPAL = {", "const moyenne = (L) => L.reduce((t, x) => t + x, 0) / L.length;\nconst PRINCIPAL = {")],
  vue_calcule: ['vue', (s) => s.replace("const C = M ? M.chiffres : null;", "const C = M ? M.chiffres : null; const somme = (L) => L.reduce((t, x) => t + x, 0);")],
};
const MUT = process.env.MUTATION || '';
if (MUT === 'liste') { console.log(Object.keys(MUTATIONS).join('\n')); process.exit(0); }
if (MUT && !MUTATIONS[MUT]) { console.log('❌ mutation inconnue : ' + MUT); process.exit(1); }

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };

async function charger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-journee-stats-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  // statsVentes.js (règles de Statistiques) sert au relevé ; il est importé tel quel.
  const tous = { ...FICHIERS, statsVentes: 'src/statsVentes.js' };
  let mordu = !MUT || ['vue', 'vueT', 'app'].includes(MUTATIONS[MUT][0]);
  for (const [k, rel] of Object.entries(tous)) {
    let src = fs.readFileSync(path.join(RACINE, rel), 'utf8');
    if (MUT && MUTATIONS[MUT][0] === k) { const m = MUTATIONS[MUT][1](src); if (m !== src) mordu = true; src = m; }
    const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, src);
  }
  // Les dépendances de statsVentes.js, copiées telles quelles si elles existent.
  for (const m of fs.readFileSync(path.join(RACINE, 'src/statsVentes.js'), 'utf8').matchAll(/from '(\.\/[^']+)'/g)) {
    const rel = path.join('src', m[1]); const f = path.join(dir, rel);
    if (!fs.existsSync(f) && fs.existsSync(path.join(RACINE, rel))) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(path.join(RACINE, rel), f); }
  }
  // (21 nov., lot rentabilite) pilotage.js importe « Ce que tu vends le mieux » (src/vendsMieux.js) et ses règles : copiées telles quelles.
  for (const rel of ['src/vendsMieux.js', 'src/ceQuiRapporte.js', 'src/quoiRacheter.js']) {
    const f = path.join(dir, rel); if (!fs.existsSync(f) && fs.existsSync(path.join(RACINE, rel))) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(path.join(RACINE, rel), f); }
  }
  if (!mordu) { console.log('❌ la mutation « ' + MUT + ' » ne mord pas la source : elle ne prouve rien'); process.exit(1); }
  const P = await import(path.join(dir, FICHIERS.pilotage));
  const M = await import(path.join(dir, FICHIERS.modele));
  const T = await import(path.join(dir, FICHIERS.temps));
  const SV = await import(path.join(dir, 'src/statsVentes.js'));
  // statsTransporteurs.js : sa dépendance (transporteursVisuels.js et ses règles serveur) est celle du DÉPÔT, par URL absolue.
  const ft = path.join(dir, FICHIERS.transp);
  // (21 nov., transp-depenses) + ses règles serveur (`../api/_lib/…`) : toute importation relative pointe le DÉPÔT.
  fs.writeFileSync(ft, fs.readFileSync(ft, 'utf8').replace(/from '(\.\.?\/[^']+)'/g, (m0, rel) => "from '" + require('url').pathToFileURL(path.join(RACINE, 'src', rel)).href + "'"));
  const TR = await import(ft);
  return { P, M, T, SV, TR };
}

const D = (m, j, h = 12, mi = 0) => new Date(2026, m - 1, j, h, mi).getTime();
const MAINTENANT = D(11, 21, 15, 0);      // samedi 21 novembre 2026, 15 h
const JOUR = 86400000;

// Un faux PROPRIÉTAIRE des chiffres, à la forme de `valeurChiffre` : des lignes de « Vendu » et des réponses fixées
// pour le brut et le net. Il note chaque question posée (le contrôle « une source » : la vue ne demande qu'à lui).
function proprietaire(lignes, { brut = null, net = null, partiel = false } = {}) {
  const questions = [];
  const f = (id, p, sel) => {
    questions.push([id, p]);
    const B = typeof p === 'object' && p ? p : p === 'jour' ? { de: D(11, 21, 0), a: D(11, 22, 0) } : p === 'mois' ? { de: D(11, 1, 0), a: D(12, 1, 0) } : { de: D(11, 16, 0), a: D(11, 23, 0) };
    const L = (lignes || []).filter((x) => x.ts >= B.de && x.ts < B.a && (!sel || !sel.site || sel.site === 'toutes' || x.plateforme.toLowerCase() === sel.site) && (!sel || !sel.compte || x.compte === sel.compte.login));
    if (id === 'vendu') return lignes ? { valeur: L.reduce((t, x) => t + x.eur, 0), partiel, manque: partiel ? ['eBay'] : [] } : { valeur: null, raison: 'pasSu' };
    if (id === 'ventes') return lignes ? { valeur: L.length, partiel } : { valeur: null, raison: 'pasSu' };
    if (id === 'brut') return brut ? brut(B, L) : { valeur: null, raison: 'achats' };
    if (id === 'benefice') return net ? net(p) : { valeur: null, raison: 'achats' };
    return { valeur: null, raison: 'inconnu' };
  };
  f.questions = questions;
  return f;
}
const raisonCourte = (x) => (x && x.valeur == null ? ({ pasSu: 'pas lu', achats: 'prix d’achat manquants', rien: 'rien à compter' }[x.raison] || 'pas lu') : '');

(async () => {
  const { P, M, T, SV, TR } = await charger();
  console.log('── F. Les fenêtres');
  const f7 = P.fenetre('7', MAINTENANT), f30 = P.fenetre('30', MAINTENANT), f90 = P.fenetre('90', MAINTENANT);
  dit(f7.a === D(11, 22, 0) && f7.de === D(11, 15, 0) && P.joursFenetre('7', MAINTENANT).length === 7 && P.joursFenetre('90', MAINTENANT).length === 90 && f30.n === 30 && f90.n === 90,
    'F1 7 j = du 15 au 21 novembre (aujourd’hui compris en entier), 7 jours ; 90 j = 90 jours', [f7, P.joursFenetre('7', MAINTENANT).length]);

  console.log('\n── G. Les gestes de VRM');
  const EV = [
    { type: 'favori', resultat: 'ok', at: D(11, 21, 9), cle: { item: '111' }, auto: true },
    { type: 'favori_offre', resultat: 'ok', at: D(11, 20, 9), cle: { item: '222' }, auto: true },
    { type: 'favori', resultat: 'refuse', at: D(11, 20, 10), cle: { item: '333' } },
    { type: 'bordereau', resultat: 'ok', at: new Date(D(11, 19, 8)).toISOString(), cle: { tx: '9' } },
    { type: 'baisse_prix', resultat: 'ok', at: String(D(11, 18, 8)), cle: { item: '444' } },
    { type: 'moderation_masquee', resultat: 'ok', at: D(11, 18, 9) },          // un constat de Vinted, pas un geste de VRM
    { type: 'vacances_pose', resultat: 'ok', at: D(11, 21, 7) },               // pas dans les familles de VRM
    { type: 'republication', resultat: 'ok', at: D(10, 1, 8), cle: { item: '555' } },   // hors des 30 jours
  ];
  const G30 = P.gestesFenetre(EV, '30', MAINTENANT);
  dit(G30.n === 4 && G30.auto === 2, 'G1 30 j : 4 gestes ACCEPTÉS de VRM (le refusé, le constat de Vinted, le mode vacances et celui d’octobre n’y sont pas), dont 2 automatiques', G30);
  dit(P.gestesFenetre(null, '30', MAINTENANT) === null, 'G2 journal pas lu ⇒ null (« — »), jamais 0');

  console.log('\n── T. Le temps gagné (estimation)');
  const T30 = P.tempsGagneFenetre(EV, '30', MAINTENANT);
  const attendu = (60 - 0) * 2 + (120 - 20) + (60 - 10);     // 2 favoris, 1 bordereau (GESTES « bordereaux »), 1 baisse (GESTES « prix »)
  dit(T30.minutes === Math.round(attendu / 60) && T30.nCompte === 4 && T30.n === 4, 'T1 chaque geste × SA durée de référence : 2 messages (1 min), 1 bordereau (la durée du calculateur, 100 s), 1 baisse (50 s)', T30);
  dit(T.secondesGeste('vacances_pose') === null && T.secondesGeste('bordereau') === T.GESTES.find((g) => g.id === 'bordereaux').sans - T.GESTES.find((g) => g.id === 'bordereaux').avec,
    'T2 un type sans durée ne compte pour rien (null) ; le bordereau reprend la durée du calculateur (une durée, un endroit)');
  const EV2 = [...EV, { type: 'ebay_retrait', resultat: 'ok', at: D(11, 21, 10) }];
  const T2 = P.tempsGagneFenetre(EV2.map((e) => (e.type === 'ebay_retrait' ? { ...e, type: 'offre_refusee' } : e)), '30', MAINTENANT);
  dit(T2.nCompte === T2.n, 'T3 « k gestes sur n » : la couverture est rendue avec le chiffre', T2);

  console.log('\n── S. La série d’activité');
  const S1 = P.serieActivite(EV, MAINTENANT);
  dit(S1.jours === 4 && S1.aujourdhui === true, 'S1 21, 20, 19 et 18 novembre ont chacun un geste accepté ⇒ 4 jours d’affilée, aujourd’hui compris', S1);
  const S2 = P.serieActivite(EV.filter((e) => e.at !== D(11, 21, 9)), MAINTENANT);
  dit(S2.jours === 3 && S2.aujourdhui === false, 'S2 rien encore aujourd’hui ⇒ la série compte jusqu’à hier (3 jours)', S2);
  const S3 = P.serieActivite(EV.filter((e) => e.type !== 'bordereau'), MAINTENANT);
  dit(S3.jours === 2, 'S3 un jour sans geste (le 19) coupe la série : 2 jours', S3);

  console.log('\n── V. Messages aux favoris → ventes, par identité');
  const LIGNES = [
    { plateforme: 'Vinted', tx: 't1', ts: D(11, 21, 12), eur: 60.5, compte: 'a' },       // annonce 111, 3 h après le message ⇒ comptée
    { plateforme: 'Vinted', tx: 't2', ts: D(11, 19, 12), eur: 40, compte: 'a' },       // annonce 222 vendue AVANT le message ⇒ non
    { plateforme: 'Vinted', tx: 't3', ts: D(11, 21, 13), eur: 55, compte: 'b', titre: 'Même titre que 111' },   // autre annonce (999) ⇒ non
    { plateforme: 'eBay', tx: 'e1', ts: D(11, 20, 12), eur: 80 },
  ];
  const ITEM = { t1: '111', t2: '222', t3: '999' };
  const Fv = P.favorisVersVentes({ evenements: EV, lignes: LIGNES, itemDeTx: (tx) => ITEM[tx] || null, cle: '30', maintenant: MAINTENANT });
  dit(Fv.envoyes === 2 && Fv.avecOffre === 1 && Fv.annonces === 2 && Fv.ventes === 1 && Fv.taux === 50,
    'V1 2 messages envoyés (le refusé n’est pas envoyé), 2 annonces contactées, 1 vendue ensuite par SON identifiant (la vente au même titre d’une autre annonce et celle d’avant le message ne comptent pas)', Fv);
  const Fv2 = P.favorisVersVentes({ evenements: EV, lignes: [{ plateforme: 'Vinted', tx: 't1', ts: D(11, 21, 9) + 20 * JOUR, eur: 60 }], itemDeTx: (tx) => ITEM[tx], cle: '30', maintenant: D(12, 15) });
  dit(Fv2.ventes === 0, 'V2 une vente 20 jours après le message (au-delà de 14 jours) ne compte pas', Fv2);
  const Fv3 = P.favorisVersVentes({ evenements: EV, lignes: LIGNES, itemDeTx: null, cle: '30', maintenant: MAINTENANT });
  dit(Fv3.envoyes === 2 && Fv3.ventes === null && Fv3.taux === null, 'V3 ventes pas reliées à leur annonce (détail de transaction pas lu) ⇒ « — », jamais 0', Fv3);

  console.log('\n── U. Une source par chiffre');
  const vrai = proprietaire(LIGNES, { brut: (B, L) => ({ valeur: 33.3, partiel: true, couverture: '1 sur 2', n: 2 }) });
  const SF = P.statsFenetre({ cle: '7', valeur: vrai, evenements: EV, lignes: LIGNES, itemDeTx: (tx) => ITEM[tx] || null, releve: null, regles: { delaisPar: SV.delaisPar, margesPar: SV.margesPar }, raisonCourte,
    enLigne: { valeur: 50 }, maintenant: MAINTENANT });
  const F7 = P.fenetre('7', MAINTENANT);
  const direct = { vendu: vrai('vendu', F7).valeur, ventes: vrai('ventes', F7).valeur };
  dit(SF.chiffres.vendu.valeur === direct.vendu && SF.chiffres.ventes.valeur === direct.ventes && direct.vendu === 235.5,
    'U1 le CA vendu et le nombre de ventes de la fenêtre = ce que rend le propriétaire pour CETTE fenêtre (235,50 € · 4 ventes), sans rien recalculer', { SF: SF.chiffres.vendu, direct });
  dit(SF.chiffres.panier.valeur === Math.round((235.5 / 4) * 100) / 100 && SF.chiffres.brut.valeur === 33.3 && SF.chiffres.brut.couverture === '1/2',
    'U2 panier = vendu ÷ ventes (les deux lus en entier) ; bénéfice brut = celui du propriétaire, AVEC sa couverture « 1/2 »', SF.chiffres);
  dit(SF.ecoulement && SF.ecoulement.pct === 8, 'U3 taux de vente = ventes de la fenêtre ÷ annonces en ligne (4 ÷ 50 = 8 %)', SF.ecoulement);
  dit(SF.plateformes.map((x) => x.cle + ':' + x.v).join() === 'vinted:155.5,ebay:80', 'U4 par site : chaque ligne demandée au propriétaire avec SA sélection (Vinted 155,50 €, eBay 80 €)', SF.plateformes);
  const part = proprietaire(LIGNES, { partiel: true });
  const SP = P.statsFenetre({ cle: '7', valeur: part, evenements: null, lignes: LIGNES, itemDeTx: null, releve: undefined, regles: { delaisPar: SV.delaisPar, margesPar: SV.margesPar }, raisonCourte, maintenant: MAINTENANT });
  dit(SP.chiffres.vendu.partiel === true && SP.chiffres.panier.valeur === null && SP.gestes === null && SP.temps === null && SP.serie === null && SP.releve === undefined,
    'U5 vendu partiel ⇒ « au moins » et pas de panier (une moyenne sur une partie n’est pas un minimum) ; journal pas lu ⇒ « — » partout ; relevé en lecture ⇒ en lecture', SP.chiffres.panier);
  const SN = P.statsFenetre({ cle: '30', valeur: proprietaire(null), evenements: [], lignes: null, itemDeTx: null, releve: null, regles: { delaisPar: SV.delaisPar, margesPar: SV.margesPar }, raisonCourte, maintenant: MAINTENANT });
  dit(SN.chiffres.vendu.valeur === null && SN.chiffres.ventes.valeur === null && SN.plateformes === null && SN.comptes === null && SN.jours.every((j) => j.ca === null && j.ventes === null),
    'U6 ventes pas lues ⇒ « — » partout (jamais 0), 30 jours de « — »', SN.chiffres.vendu);
  // Ma journée : brut et net — chacun son propriétaire.
  const pj = proprietaire(LIGNES, { brut: () => ({ valeur: 25, partiel: false, couverture: '', n: 1 }), net: (p) => (p === 'jour' ? { valeur: 18.4, B: { chargesAuMois: true } } : { valeur: null, raison: 'achats', B: { chargesAuMois: false } }) });
  const ST = M.statsPeriodes({ valeur: pj, raisonCourte });
  dit(ST.jour.brut.valeur === 25 && ST.jour.net.valeur === 18.4 && ST.jour.net.auMois === true && ST.mois.net.valeur === null && ST.mois.net.note === 'prix d’achat manquants',
    'U7 Ma journée : bénéfice brut = `brut` du propriétaire, bénéfice net = `benefice` du propriétaire (aujourd’hui : dépenses comptées au mois, dit) ; pas su ⇒ « — » et la raison', { jour: ST.jour.net, mois: ST.mois.net });
  dit(pj.questions.some(([id, p]) => id === 'benefice' && p === 'jour') && pj.questions.some(([id, p]) => id === 'benefice' && p === 'mois'), 'U8 le net du jour et du mois sont DEMANDÉS au propriétaire (« benefice », jour et mois)');
  const pb = proprietaire(LIGNES, { brut: () => ({ valeur: 25, partiel: false, couverture: '', n: 1 }) });
  const SB = M.statsPeriodes({ valeur: pb, raisonCourte });
  dit(SB.jour.brut.partiel === true && SB.jour.brut.couverture === '1/2', 'U9 la publication du bénéfice compte 1 vente sur les 2 du jour ⇒ la couverture « 1/2 » est dite (jamais un brut présenté complet)', SB.jour.brut);
  const evMs = [{ type: 'favori', resultat: 'ok', at: D(11, 21, 9) }];
  dit(M.vrmDuJour(evMs, MAINTENANT).length === 1 && P.gestesFenetre(evMs, '7', MAINTENANT).n === 1, 'U10 l’heure en millisecondes (la forme de la route du journal) est lue');

  console.log('\n── R. Transporteurs (ventes et achats)');
  const TRm = TR;
  const H = 3600000;
  const iso = (t) => (t == null ? null : new Date(t).toISOString());
  const vte = (cle, venteAt, depot, livre, extra = {}) => TRm.ligneVente({ tr: cle ? { cle, nom: cle } : null, venteAt, depart: depot == null ? null : { priseAt: iso(depot), etat: livre ? 'disponible' : (extra.etat || 'en_route'), etatAt: iso(livre != null ? livre : extra.etatAt) }, limiteAt: extra.limite == null ? null : extra.limite, status: extra.status || '' });
  const t0 = D(11, 10, 9);
  const VT = [
    vte('mondialrelay', t0, t0 + 24 * H, t0 + 72 * H, { limite: t0 + 48 * H }),
    vte('mondialrelay', t0 + JOUR, t0 + JOUR + 12 * H, t0 + JOUR + 60 * H, { limite: t0 + JOUR + 48 * H }),
    vte('mondialrelay', t0 + 2 * JOUR, t0 + 2 * JOUR + 36 * H, null, { limite: t0 + 2 * JOUR + 24 * H }),   // déposé en retard, pas livré
    vte('mondialrelay', t0 + 3 * JOUR, null, null, { limite: t0 + 5 * JOUR }),                            // pas de prise en charge lue
    vte('mondialrelay', t0 + 4 * JOUR, t0 + 4 * JOUR + 10 * 24 * H, t0 + 4 * JOUR + 12 * 24 * H, { status: 'Retour en cours' }),   // bloqué 10 j : écarts forts
    vte('vinted', t0, t0 + 20 * H, t0 + 50 * H),
    vte('vinted', t0 + JOUR, t0 + JOUR + 20 * H, null, { etat: 'retire', etatAt: t0 + JOUR + 90 * H }),                                  // retiré : l'arrivée n'est pas lue
    vte(null, t0, t0 + 20 * H, null),
    vte('chronopost', D(9, 1, 9), D(9, 2, 9), D(9, 4, 9)),                                                 // hors fenêtre (30 j)
  ];
  const STR = TRm.statsTransporteurs({ ventes: VT, achats: null, de: MAINTENANT - 30 * JOUR, a: MAINTENANT + JOUR });
  const mr = STR.ventes.transporteurs.find((x) => x.cle === 'mondialrelay');
  dit(STR.ventes.total === 8 && STR.achats === null && STR.ventes.transporteurs.map((x) => x.cle + ':' + x.n).join() === 'mondialrelay:5,vinted:2' && STR.ventes.inconnu && STR.ventes.inconnu.n === 1,
    'R1 fenêtre par date de vente ; achats pas lus ⇒ null (jamais une liste vide) ; « inconnu » compté À PART (1), jamais dans un transporteur', STR.ventes.transporteurs.map((x) => x.cle + ':' + x.n));
  dit(mr.depot.n === 4 && mr.depot.sur === 5 && mr.depot.mode === 'mediane' && mr.depot.jours === 1.3,
    'R2 vente → dépôt sur les seules prises en charge LUES (4 sur 5) ; un colis bloqué 10 j ⇒ écarts forts ⇒ MÉDIANE (1,3 j), le mode est rendu', mr.depot);
  dit(mr.livraison.n === 3 && mr.livraison.mode === 'moyenne' && mr.livraison.jours === 2 && STR.ventes.transporteurs.find((x) => x.cle === 'vinted').livraison.jours === null && STR.ventes.transporteurs.find((x) => x.cle === 'vinted').livraison.n === 1,
    'R3 dépôt → livraison : arrivée LUE seulement (un « retiré » sans arrivée datée sort du calcul) ; Vinted Go, 1 livraison lue ⇒ « — » ; trois livraisons régulières ⇒ moyenne 2 j', mr.livraison);
  dit(mr.aTemps.ok === 2 && mr.aTemps.retard === 1 && mr.aTemps.sur === 3 && mr.retours === 1,
    'R4 à temps sur la LIMITE LUE seulement (2 à temps, 1 en retard sur 3 ; sans limite ⇒ hors compte, jamais « vente + 7 j ») ; retour lu dans l’état Vinted', { aTemps: mr.aTemps, retours: mr.retours });
  dit(TRm.delai([[0, JOUR], [0, 2 * JOUR]]).jours === null && TRm.delai([[0, JOUR], [0, 2 * JOUR], [0, 3 * JOUR]]).mode === 'moyenne' && TRm.delai([[0, JOUR], [0, 2 * JOUR], [0, 3 * JOUR]]).jours === 2,
    'R5 moins de 3 colis mesurés ⇒ « — » ; écarts réguliers ⇒ MOYENNE (2 j)');
  const tr = { etapes: [['paye', t0], ['expedie', t0 + 30 * H], ['transit', null], ['point', t0 + 60 * H], ['retire', null]].map(([cle, at]) => ({ cle, at, lue: at != null })) };
  const A1 = TRm.ligneAchat({ tr: { cle: 'vinted', nom: 'Vinted Go' }, payeAt: t0, trajet: tr, ligne: { etat: 'retire', etatAt: iso(t0 + 80 * H), lieuNom: 'Relais A', lieuVille: 'Ville' } });
  const A2 = TRm.ligneAchat({ tr: { cle: 'vinted', nom: 'Vinted Go' }, payeAt: t0, trajet: null, ligne: { etat: 'retour_expediteur', etatAt: iso(t0 + 9 * JOUR), lieuNom: 'Relais A', lieuVille: 'Ville' } });
  dit(A1.expedieAt === t0 + 30 * H && A1.pointAt === t0 + 60 * H && A1.retireAt === t0 + 80 * H && A1.point === 'Relais A, Ville' && A2.expedieAt === null && A2.pointAt === null && A2.nonReclame === true,
    'R6 achat : expédition et arrivée prises au TRAJET lu (`etapesTrajet`), retrait à la ligne du transporteur ; sans trajet, rien n’est déduit ; retourné à l’expéditeur ⇒ non réclamé', { A1, A2 });

  console.log('\n── E. Les écrans ne calculent rien');
  const sansCommentaires = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  let vue = sansCommentaires('src/natif/ecrans/StatsPilotage.jsx');
  if (MUT && MUTATIONS[MUT][0] === 'vue') vue = MUTATIONS[MUT][1](vue);
  dit(!/\.reduce\(|statsVentes|beneficeDesJours|valeurChiffre|\/\s*x\.n\b/.test(vue), 'E1 StatsPilotage.jsx ne somme ni ne divise rien, n’importe aucune règle : il dessine le modèle');
  let vueT = sansCommentaires('src/natif/ecrans/StatsTransporteurs.jsx');
  if (MUT && MUTATIONS[MUT][0] === 'vueT') { const m = MUTATIONS[MUT][1](vueT); if (m === vueT) { console.log('❌ la mutation ne mord pas StatsTransporteurs.jsx'); process.exit(1); } vueT = m; }
  dit(!/\.reduce\(|\.sort\(|Math\.|statsTransporteurs\(|\/\s*86400000/.test(vueT), 'E5 StatsTransporteurs.jsx ne calcule rien (ni somme, ni tri, ni délai) : il dessine `statsTransporteurs`');
  const brancheT = sansCommentaires('src/aujourdhui/StatsBranche.jsx');
  const appT = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  dit(/statsTransporteurs\(\{ ventes: pubT\.ventes, achats: pubT\.achats/.test(brancheT) && /ligneVente\(\{ tr: transporteurVente\(b, tx\)/.test(appT) && /ligneAchat\(\{ tr: transporteurDuColis\(/.test(appT),
    'E6 une source par chiffre de Transporteurs : l’app range chaque colis par `ligneVente` (transporteur de SA vente, `transporteurVente`) et `ligneAchat` (`transporteurDuColis`), Statistiques range par `statsTransporteurs`');
  const branche = sansCommentaires('src/aujourdhui/StatsBranche.jsx');
  dit(/statsFenetre\(/.test(branche) && !/\.reduce\(/.test(branche), 'E2 StatsBranche.jsx range par `statsFenetre` (pilotage.js), sans calcul à côté');
  let app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  if (MUT && MUTATIONS[MUT][0] === 'app') { const m = MUTATIONS[MUT][1](app); if (m === app) { console.log('❌ la mutation ne mord pas App.jsx'); process.exit(1); } app = m; }
  dit(/function StatsPilotageApp[\s\S]{0,600}valeurChiffre\(id, \{ id, p \}, S, sel, REGLES_CARTE/.test(app), 'E3 Statistiques demande chaque chiffre à `valeurChiffre` sur les sources de la carte (les mêmes que Ma journée et Argent)');

  const autoSrc = fs.readFileSync(path.join(RACINE, 'src/automatisationsEtat.js'), 'utf8');
  const nTypes = (autoSrc.match(/\bn\+\+/g) || []).length;
  dit(/function StatsPilotageApp[\s\S]{0,1200}\{ n: automatisationsActives\(load\), sur: AUTOMATISATIONS_COMPTEES \}/.test(app) && /AUTOMATISATIONS_COMPTEES = (\d+)/.test(autoSrc) && Number(autoSrc.match(/AUTOMATISATIONS_COMPTEES = (\d+)/)[1]) === nTypes,
    `E4 « N sur M automatisations » : N = \`automatisationsActives\` (la rangée de Paramètres), M = les ${nTypes} types que cette règle compte`);
  console.log(`\n${ko ? '❌' : '✅'} audit-journee-stats${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
