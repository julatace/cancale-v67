// ════════════════════════════════════════════════════════════════════════════
//  « AUJOURD'HUI » ET « À RÉGLER » — LES RÈGLES, EXÉCUTÉES (19 nov.).
//  Décisions de Julien du 19 nov., mot pour mot : « tout ça ne sert à rien, ça doit être rangé dans les onglets dédiés
//  justement à ça […] je pense qu'il y a d'autres choses plus intéressantes pour cet onglet » ; « l'outil doit être
//  pratique, pas chiant ». Récit : docs/passation/2026-11-19-aujourdhui-propre.md.
//
//  Ce script EXÉCUTE src/aujourdhui/modele.js et src/designV2/aRegler.js (purs, sans React) sur des données inventées :
//    A  les chiffres : trois états (en cours · pas su · lu), « pas su » n'est jamais 0, les 7 jours dans l'ordre
//       (aujourd'hui en dernier), le jour montré (aujourd'hui s'il a vendu, sinon le dernier jour utile) ;
//    B  le mois : vendu / reçu / bénéfice tels que le propriétaire les rend ; un bénéfice BRUT porte sa couverture
//       (« k sur n ») et n'est jamais « au moins » ; l'argent à venir seulement s'il est lu ;
//    C  les dernières ventes : les 5 plus récentes, par identité `plateforme:tx` (jamais deux fois, jamais sans date
//       ni identité) ; « pas su » rend null, pas [] ;
//    D  l'alerte : AU PLUS une ; une limite ESTIMÉE ne presse jamais ; l'ordre poster → retirer → retour ;
//    E  « À régler » : chaque groupe va dans SON onglet (la table de l'audit d'utilité du 19 nov., §4.1 ; sinon l'écran de son geste) ; les
//       trois manques d'annonce deviennent UNE rangée « Compléter » ; l'urgent d'abord ; la pastille n'ajoute pas ce
//       qu'elle compte déjà ; le geste est celui du groupe ;
//    F  la publication : gardée 12 h sur l'appareil, par vendeur ; sans publication ⇒ null (rien d'inventé) ;
//    S  la source : Aujourd'hui ne rend plus de liste « À faire », il publie.
//  Preuve par mutation : `MUTATION=<nom>` réaffaiblit une règle dans la source avant de l'exécuter ⇒ rouge
//  (`MUTATION=liste` les nomme). Un contrôle qui ne peut pas échouer est pire qu'absent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const F_MODELE = path.join(RACINE, 'src', 'aujourdhui', 'modele.js');
const F_REGLER = path.join(RACINE, 'src', 'designV2', 'aRegler.js');

const MUTATIONS = {
  passu_zero: ['modele', (s) => s.replace("v: V.valeur == null ? null : V.valeur,", "v: V.valeur == null ? 0 : V.valeur,")],
  jour_toujours_auj: ['modele', (s) => s.replace("for (let i = n - 2; i >= 0; i--) if (jours[i].v > 0) return i;", "")],
  ordre_jours: ['modele', (s) => s.replace("return [6, 5, 4, 3, 2, 1, 0].map((k) => {", "return [0, 1, 2, 3, 4, 5, 6].map((k) => {")],
  brut_au_moins: ['modele', (s) => s.replace("? { valeur: brut.valeur, partiel: false, note: '', brut: true, couverture: { k: Bn.nCout, n: Bn.n } }", "? { valeur: brut.valeur, partiel: true, note: '', brut: true, couverture: null }")],
  avenir_zero: ['modele', (s) => s.replace("aVenir: at && at.valeur != null ? { valeur: at.valeur, partiel: !!at.partiel } : null };", "aVenir: { valeur: (at && at.valeur) || 0, partiel: false } };")],
  ventes_doublon: ['modele', (s) => s.replace("if (vus.has(cle)) continue; vus.add(cle);", "")],
  ventes_sans_identite: ['modele', (s) => s.replace("&& x.tx != null && String(x.tx) !== '' && x.plateforme)", ")")],
  ventes_vide_pour_passu: ['modele', (s) => s.replace("if (!Array.isArray(lignes)) return null;", "if (!Array.isArray(lignes)) return [];")],
  alerte_estimee: ['modele', (s) => s.replace("t.at != null && t.limite !== 'estimee' && (t.retard", "t.at != null && (t.depasse || t.retard")],
  alerte_apres_demain: ['modele', (s) => s.replace("t.daysLeft <= 1))", "t.daysLeft <= 3))")],
  alerte_retour_tard: ['modele', (s) => s.replace("return j != null && j >= 0 && j <= 1; });", "return j != null && j <= 9; });")],
  litige_achat_dans_ventes: ['regler', (s) => s.replace("if (r === 'litige') return g.sens === 'achat' ? 'achats' : 'ventes';", "if (r === 'litige') return 'ventes';")],
  tout_dans_sante: ['regler', (s) => s.replace("if (PAR_ID[r]) return PAR_ID[r];", "")],
  trois_manques: ['regler', (s) => s.replace("if (!manques.length) return trier(l);", "return trier(l);")],
  pastille_double: ['regler', (s) => s.replace(".filter((g) => !DEJA_DANS_LA_PASTILLE.has(racineId(g.id))).length;", ".length;")],
  garde_eternelle: ['regler', (s) => s.replace("maintenant - Number(v.at) > AGE_MAX_MS ||", "")],
  garde_partagee: ['regler', (s) => s.replace("const cle = () => CLE_A_REGLER + (branche.uid ? ':' + branche.uid : '');", "const cle = () => CLE_A_REGLER;")],
  urgent_noye: ['regler', (s) => s.replace("(b[0].ambre ? 1 : 0) - (a[0].ambre ? 1 : 0) || ", "")],
  rien_pour_passu: ['regler', (s) => s.replace("if (!etat && !gardeLue) { gardeLue = true; etat = lireGarde(maintenant); }", "if (!etat) etat = { at: maintenant, frais: false, groupes: [] };")],
};
const MUT = process.env.MUTATION || '';
if (MUT === 'liste') { console.log(Object.keys(MUTATIONS).join('\n')); process.exit(0); }
if (MUT && !MUTATIONS[MUT]) { console.log('❌ mutation inconnue : ' + MUT); process.exit(1); }

async function charger(fichier, quoi) {
  let src = fs.readFileSync(fichier, 'utf8');
  if (MUT && MUTATIONS[MUT][0] === quoi) { const m = MUTATIONS[MUT][1](src); if (m === src) { console.log('❌ la mutation « ' + MUT + ' » ne mord pas la source : elle ne prouve rien'); process.exit(1); } src = m; }
  const f = path.join(os.tmpdir(), `${quoi}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };
const D = (m, j, h = 12, mi = 0) => new Date(2026, m - 1, j, h, mi).getTime();
const MAINTENANT = D(11, 19, 9, 30);      // jeudi 19 novembre 2026, 9 h 30

// Un faux propriétaire des chiffres, à la FORME de `valeurChiffre` : des lignes de « Vendu » (ventesFaites), un reçu
// et un bénéfice publiés. (Le vrai est comparé à l'écran Argent par le banc de rendu, sur la même base.)
function proprietaire({ lignes, recu = null, benefice = null, attente = null, partielVendu = false }) {
  return (id, p) => {
    const B = p === 'jour' ? { de: D(11, 19, 0), a: D(11, 20, 0) } : p === 'mois' ? { de: D(11, 1, 0), a: D(12, 1, 0) } : p;
    if (id === 'vendu' || id === 'ventes') {
      if (lignes === undefined) return { valeur: null, raison: 'encours' };
      if (!Array.isArray(lignes)) return { valeur: null, raison: 'pasSu' };
      const l = lignes.filter((x) => x.ts >= B.de && x.ts < B.a);
      const val = id === 'vendu' ? l.reduce((t, x) => t + x.eur, 0) : l.length;
      if (partielVendu && !(val > 0)) return { valeur: null, partiel: true, manque: ['eBay'], raison: 'partiel' };
      return { valeur: val, partiel: partielVendu, manque: partielVendu ? ['eBay'] : [], raison: '' };
    }
    if (id === 'recu') return recu || { valeur: null, raison: 'absente' };
    if (id === 'benefice') return benefice || { valeur: null, raison: 'pasSu' };
    if (id === 'attente') return attente || { valeur: null, raison: 'pasSu' };
    return { valeur: null, raison: 'inconnu' };
  };
}
const raisonCourte = (x) => (x && x.valeur == null ? ({ encours: 'lecture…', pasSu: 'pas lu', partiel: 'pas tout lu', absente: 'ouvre Ventes', achats: 'prix d’achat manquants' }[x.raison] || 'pas lu') : '');
// La forme de `questionsArgent` (src/argent.js) : la valeur, « au moins », la note.
const questions = ({ vendu, recu, benefice }) => [['vendu', vendu], ['recu', recu], ['benefice', benefice]].map(([id, x]) => (!x || x.valeur == null ? { id, valeur: null, partiel: false, note: raisonCourte(x) || 'pas lu' } : { id, valeur: x.valeur, partiel: !!x.partiel, note: '' }));
const chiffreBrut = (R) => (R && R.nCout > 0 ? { valeur: R.brut, partiel: R.nCout < R.n, nCout: R.nCout, n: R.n } : { valeur: null });

(async () => {
  const M = await charger(F_MODELE, 'modele');
  const R = await charger(F_REGLER, 'regler');

  console.log('\n── A. Les chiffres du jour et des sept jours');
  const LIGNES = [
    { plateforme: 'Vinted', ts: D(11, 18, 21), eur: 45, tx: '9001' }, { plateforme: 'Vinted', ts: D(11, 18, 8), eur: 30, tx: '9002' },
    { plateforme: 'eBay', ts: D(11, 16, 14), eur: 80, tx: 'E-1' }, { plateforme: 'Vinted', ts: D(11, 13, 0, 5), eur: 20, tx: '9003' },
    { plateforme: 'Leboncoin', ts: D(11, 12, 23, 59), eur: 999, tx: 'L-1' },      // il y a 7 jours et 9 h : hors des sept jours
    { plateforme: 'Vinted', ts: D(11, 2, 10), eur: 60, tx: '9004' },
  ];
  const base = { etatVendu: 'lu', maintenant: MAINTENANT, raisonCourte, questions, chiffreBrut, mois: 'nov.' };
  const c1 = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: LIGNES }) });
  dit(c1.etat === 'lu' && c1.jours.length === 7 && c1.jours[6].auj && c1.jours[6].cle === '2026-11-19' && c1.jours[0].cle === '2026-11-13', 'A1 sept jours, le plus ancien d’abord, aujourd’hui en dernier', c1.jours.map((j) => j.cle));
  dit(JSON.stringify(c1.jours.map((j) => j.v)) === '[20,0,0,80,0,75,0]' && JSON.stringify(c1.jours.map((j) => j.n)) === '[1,0,0,1,0,2,0]', 'A2 chaque jour porte SON vendu et SES ventes (minuit → minuit, le 12 nov. à 23 h 59 est dehors)', c1.jours.map((j) => [j.v, j.n]));
  dit(c1.montre === 5 && c1.jours[c1.montre].cle === '2026-11-18', 'A3 rien vendu ce matin ⇒ le grand chiffre dit le dernier jour utile (hier), pas « 0 € »', c1.montre);
  const c1b = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: [...LIGNES, { plateforme: 'Vinted', ts: D(11, 19, 8), eur: 12, tx: '9005' }] }) });
  dit(c1b.montre === 6 && c1b.jours[6].v === 12, 'A4 une vente aujourd’hui ⇒ le grand chiffre dit aujourd’hui', [c1b.montre, c1b.jours[6].v]);
  const c2 = M.chiffresAujourdhui({ ...base, etatVendu: 'pasSu', valeur: proprietaire({ lignes: null }) });
  dit(c2.etat === 'passu' && c2.jours.every((j) => j.v === null && j.n === null) && c2.raison === 'pas lu', 'A5 pas su ⇒ « — » et sa raison sur chaque jour, jamais 0', { etat: c2.etat, v: c2.jours.map((j) => j.v), raison: c2.raison });
  const c3 = M.chiffresAujourdhui({ ...base, etatVendu: 'encours', valeur: proprietaire({ lignes: undefined }) });
  dit(c3.etat === 'encours' && c3.jours.every((j) => j.v === null), 'A6 en cours ⇒ la lecture est dite en cours (≠ pas su), aucune valeur', c3.etat);
  const c4 = M.chiffresAujourdhui({ ...base, sansCompte: true, valeur: proprietaire({ lignes: undefined }) });
  dit(c4.etat === 'passu', 'A7 aucun compte relié (prouvé par la coque) ⇒ pas su, pas une lecture sans fin', c4.etat);
  const c5 = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: LIGNES, partielVendu: true }) });
  dit(c5.jours[5].v === 75 && c5.jours[5].partiel === true && c5.jours[6].v === null && c5.jours[6].raison === 'pas tout lu', 'A8 un total partiel dit « au moins » ; un partiel à 0 est « — » (jamais « au moins 0 »)', c5.jours.slice(5));

  console.log('\n── B. Le mois : Vendu · Reçu · Bénéfice, et l’argent à venir');
  dit(c1.mois.vendu.valeur === 1234 && c1.mois.recu.valeur === null && c1.mois.recu.note === 'ouvre Ventes' && c1.mois.benefice.valeur === null && c1.aVenir === null,
    'B1 le vendu du mois est celui du propriétaire ; reçu et bénéfice pas publiés ⇒ « — » et la raison ; pas d’argent à venir inventé', c1.mois);
  const net = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: LIGNES, recu: { valeur: 310.5, partiel: true, manque: ['à dater'] }, benefice: { valeur: 96, B: { n: 6, nCout: 6, brut: 96 } }, attente: { valeur: 140, partiel: false } }) });
  dit(net.mois.recu.valeur === 310.5 && net.mois.recu.partiel === true && net.mois.benefice.valeur === 96 && net.mois.benefice.brut === false && net.mois.benefice.couverture === null && net.aVenir && net.aVenir.valeur === 140,
    'B2 lu : le reçu garde son « au moins », le bénéfice net est dit tel quel, l’argent à venir est lu', net.mois);
  const brut = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: LIGNES, benefice: { valeur: null, raison: 'achats', B: { n: 30, nCout: 12, brut: 187 } } }) });
  dit(brut.mois.benefice.valeur === 187 && brut.mois.benefice.brut === true && brut.mois.benefice.partiel === false && brut.mois.benefice.couverture && brut.mois.benefice.couverture.k === 12 && brut.mois.benefice.couverture.n === 30,
    'B3 des prix d’achat manquent ⇒ le brut des ventes au prix connu, AVEC sa couverture (12 sur 30), jamais « au moins »', brut.mois.benefice);
  const sans = M.chiffresAujourdhui({ ...base, valeur: proprietaire({ lignes: LIGNES, benefice: { valeur: null, raison: 'achats', B: { n: 30, nCout: 0, brut: 0 } } }) });
  dit(sans.mois.benefice.valeur === null && sans.mois.benefice.note === 'prix d’achat manquants', 'B4 aucun prix d’achat connu ⇒ « — » et la raison (pas un bénéfice de 0 €)', sans.mois.benefice);

  console.log('\n── C. Les dernières ventes');
  const dv = M.dernieresVentes([...LIGNES, { plateforme: 'Vinted', ts: D(11, 18, 21), eur: 45, tx: '9001' }, { plateforme: 'Vinted', ts: NaN, eur: 5, tx: '9099' }, { plateforme: 'Vinted', ts: D(11, 19, 9), eur: 7, tx: '' }, null]);
  dit(dv.length === 5 && dv.map((x) => x.cle).join() === 'Vinted:9001,Vinted:9002,eBay:E-1,Vinted:9003,Leboncoin:L-1', 'C1 les 5 plus récentes, toutes plateformes, la plus récente d’abord', dv.map((x) => x.cle));
  dit(new Set(dv.map((x) => x.cle)).size === dv.length, 'C2 une vente (plateforme:tx) n’y est qu’une fois', dv.map((x) => x.cle));
  dit(dv.every((x) => Number.isFinite(x.ts) && x.tx), 'C3 sans date ou sans identité ⇒ pas dans la liste (jamais un titre comme identité)', dv);
  dit(M.dernieresVentes(null) === null && M.dernieresVentes(undefined) === null && Array.isArray(M.dernieresVentes([])) && M.dernieresVentes([]).length === 0, 'C4 pas su rend null ; aucune vente rend [] (les deux ne se confondent pas)');

  console.log('\n── D. L’alerte du jour (au plus une)');
  const jA = (jour) => ({ '2026-11-19': 0, '2026-11-20': 1, '2026-11-25': 6, '2026-11-17': -2 }[jour] ?? null);
  const lu0 = { at: D(11, 19, 10), limite: 'email', retard: false, depasse: false, daysLeft: 0 }, lu1 = { at: D(11, 20, 10), limite: 'email', retard: false, depasse: false, daysLeft: 1 };
  const retard = { at: D(11, 18, 10), limite: 'email', retard: true, depasse: true, daysLeft: -1 };
  const estimee = { at: D(11, 17, 10), limite: 'estimee', retard: false, depasse: true, daysLeft: -2 }, estimee0 = { at: D(11, 19, 23), limite: 'estimee', retard: false, depasse: false, daysLeft: 0 };
  const loin = { at: D(11, 22, 10), limite: 'email', retard: false, depasse: false, daysLeft: 3 };
  dit(M.alerteDuJour({ aPoster: [estimee, estimee0, loin], urgentsRetrait: 0, retours: [], joursAvant: jA }) === null, 'D1 une limite ESTIMÉE (vente + 7 j), même dépassée, n’alerte jamais ; une limite lue dans 3 jours non plus');
  const a1 = M.alerteDuJour({ aPoster: [lu1, estimee, lu0, retard, loin], urgentsRetrait: 4, retours: [{ limiteJour: '2026-11-19' }], joursAvant: jA });
  dit(a1 && a1.id === 'poster' && a1.n === 3 && a1.premier === retard, 'D2 trois colis à poster pressés (limite LUE) ; le retard d’abord ; UNE seule alerte même si autre chose presse', a1 && { id: a1.id, n: a1.n });
  const a2 = M.alerteDuJour({ aPoster: [estimee], urgentsRetrait: 2, retours: [{ limiteJour: '2026-11-19' }], joursAvant: jA });
  dit(a2 && a2.id === 'retirer' && a2.n === 2, 'D3 sinon, les colis à retirer qui pressent', a2);
  const a3 = M.alerteDuJour({ aPoster: [], urgentsRetrait: null, retours: [{ limiteJour: '2026-11-25' }, { limiteJour: '2026-11-20' }, { limiteJour: '2026-11-17' }, { limiteJour: '' }], joursAvant: jA });
  dit(a3 && a3.id === 'retour' && a3.n === 1, 'D4 sinon, un retour à déposer aujourd’hui ou demain (ni dans 6 jours, ni sans date lue)', a3);
  dit(M.alerteDuJour({ aPoster: [], urgentsRetrait: null, retours: [], joursAvant: jA }) === null && M.alerteDuJour() === null, 'D5 rien ne presse (ou pas su) ⇒ aucune alerte');

  console.log('\n── E. « À régler » : chaque groupe dans SON onglet');
  const fait = [];
  const g = (id, plus = {}) => ({ id, titre: 'T ' + id, n: 2, icone: 'box', ambre: false, geste: { txt: 'Voir', faire: () => fait.push(id) }, ...plus });
  const GROUPES = [g('messages', { n: 19, tab: 'cat_msg' }), g('colis-limite', { ambre: true, tab: 'cat_bord' }), g('litige', { sens: 'vente' }), g('litige:2', { sens: 'achat' }),
    g('retours-vente', { tab: 'cat_ventes' }), g('remettre-en-vente', { n: 8 }), g('prix-achat-vente', { n: 4, ambre: true }),
    g('achats-a-numeroter', { n: 5 }), g('retrait-a-verifier', { ambre: true, tab: 'retraits' }),
    g('sans-numero', { n: 8, tab: 'annonces' }), g('prix-mini-manquants', { n: 51 }), g('achat-a-relier', { n: 33 }), g('prix', { n: 3 }),
    g('inventaire-en-cours'), g('numeros-nouveaux', { n: 36 }), g('a-trancher'), g('urssaf', { tab: 'compta' }), g('truc-inconnu', { tab: 'garage' }), g('autre-inconnu', { tab: '' })];
  const O = Object.fromEntries(R.ONGLETS_A_REGLER.map((o) => [o, R.groupesDe(o, GROUPES).map((x) => x.id)]));
  dit(O.ventes.join() === 'colis-limite,litige,retours-vente', 'E1 Ventes : colis pressés, litige de vente, retours — l’urgent d’abord', O.ventes);
  dit(O.achats.join() === 'retrait-a-verifier,litige:2,achats-a-numeroter', 'E2 Achats : colis à vérifier, litige d’achat, achats à numéroter', O.achats);
  dit(O.stock.join() === 'inventaire-en-cours,truc-inconnu', 'E3 Stock : inventaire en cours (un inconnu suit l’écran de son geste)', O.stock);
  dit(O.sante.join() === 'a-trancher,autre-inconnu' && O.argent.join() === 'prix-achat-vente,urssaf' && O.messages.join() === 'messages', 'E4 « choses à trancher » derrière « Tout va bien ? », l’URSSAF et les ventes sans prix d’achat dans Argent, les messages = la pastille de Messages', { sante: O.sante, argent: O.argent, messages: O.messages });
  dit(O.annonces.join() === 'remettre-en-vente,prix,numeros-nouveaux,completer', 'E5 Annonces : ventes annulées à remettre en vente, prix à baisser, N° à écrire ; « sans numéro », « sans prix mini », « sans prix d’achat » = UNE rangée « Compléter », pas trois', O.annonces);
  const tous = Object.values(O).flat();
  dit(GROUPES.every((x) => tous.includes(x.id) || R.SUJETS_COMPLETER[R.racineId(x.id)]) && tous.length === GROUPES.length - 2, 'E6 aucun groupe perdu, aucun en double (19 groupes → 16 rangées + « Compléter » qui en porte 3)', tous.length);
  const comp = R.groupesDe('annonces', GROUPES, { titreCompleter: (n) => 'Compléter · ' + n }).find((x) => x.id === 'completer');
  dit(comp && comp.n === 92 && comp.titre === 'Compléter · 92' && comp.sujets.join() === 'numero,prixMini,prixAchat' && comp.ambre === false, 'E7 « Compléter » porte la somme (8 + 51 + 33) et ses trois sujets ; ce n’est pas une alerte (jamais ambre)', comp && { n: comp.n, sujets: comp.sujets, ambre: comp.ambre });
  if (comp) comp.geste.faire();
  let recu = null; const comp2 = R.groupesDe('annonces', GROUPES, { completer: (x) => { recu = x; } }).find((x) => x.id === 'completer'); if (comp2) comp2.geste.faire();
  dit(fait.join() === 'sans-numero' && recu && recu.sujet === 'numero', 'E8 sans atelier « Compléter » : le geste du premier manque ; avec : `ouvrirCompleter({ sujet })`', { fait, recu });
  fait.length = 0; { const lit = R.groupesDe('ventes', GROUPES).find((x) => x.id === 'litige'); if (lit) lit.geste.faire(); }
  dit(fait.join() === 'litige', 'E9 le geste d’une rangée est LE geste du groupe (le même qu’avant)', fait);
  dit(R.ajoutPastille('ventes', GROUPES) === 2 && R.ajoutPastille('achats', GROUPES) === 2 && R.ajoutPastille('annonces', GROUPES) === 3 && R.ajoutPastille('stock', GROUPES) === 2 && R.ajoutPastille('sante', GROUPES) === 2,
    'E10 la pastille ajoute UN par groupe, sauf ce qu’elle compte déjà (colis pressés ⊂ à envoyer, à vérifier ⊂ à retirer, « Compléter » ⊂ annonces)', ['ventes', 'achats', 'annonces', 'stock', 'sante'].map((o) => R.ajoutPastille(o, GROUPES)));
  dit(R.groupesDe('ventes', []).length === 0 && R.groupesDe('ventes', null).length === 0 && R.ajoutPastille('ventes', null) === 0, 'E11 aucun groupe ⇒ aucune rangée, rien d’ajouté à la pastille');

  console.log('\n── F. La publication (mémoire + appareil)');
  const boite = new Map();
  globalThis.localStorage = { getItem: (k) => (boite.has(k) ? boite.get(k) : null), setItem: (k, v) => boite.set(k, String(v)), removeItem: (k) => boite.delete(k) };
  const R2 = await charger(F_REGLER, 'regler');
  R2.brancherARegler({ uid: 'vendeur-a' });
  dit(R2.lireARegler(MAINTENANT) === null, 'F1 jamais publié, rien de gardé ⇒ null (pas su ≠ rien à régler)');
  let reveils = 0; const fin = R2.abonnerARegler(() => { reveils++; });
  R2.publierARegler(GROUPES, MAINTENANT);
  const p1 = R2.lireARegler(MAINTENANT);
  dit(p1 && p1.frais === true && p1.groupes.length === GROUPES.length && p1.groupes.every((x) => x.onglet) && reveils === 1, 'F2 publié : chaque groupe a son onglet, les lecteurs sont réveillés une fois', { n: p1 && p1.groupes.length, reveils });
  R2.publierARegler(GROUPES.map((x) => ({ ...x })), MAINTENANT + 1000);
  dit(reveils === 1 && R2.lireARegler(MAINTENANT) === p1, 'F3 même contenu republié ⇒ personne n’est réveillé (aucun rendu en boucle)', reveils);
  R2.publierARegler(GROUPES.slice(1), MAINTENANT + 2000);
  dit(reveils === 2 && R2.lireARegler(MAINTENANT).groupes.length === GROUPES.length - 1, 'F4 un groupe réglé ⇒ la publication change, les lecteurs sont réveillés', reveils);
  fin();
  const gardee = [...boite.keys()];
  dit(gardee.length === 1 && gardee[0].endsWith(':vendeur-a') && !/faire|=>/.test(boite.get(gardee[0])), 'F5 un résumé est gardé sur l’appareil, au nom du vendeur, sans fonction', gardee);
  // Une autre session (l'app rouverte directement sur Ventes) : le résumé gardé, dont le geste OUVRE l'écran.
  const R3 = await charger(F_REGLER, 'regler');
  const ouverts = []; R3.brancherARegler({ uid: 'vendeur-a', naviguer: (e) => ouverts.push(e) });
  const p3 = R3.lireARegler(MAINTENANT + 3600000);
  const ret = p3 && R3.groupesDe('ventes', p3.groupes).find((x) => x.id === 'retours-vente'); if (ret && ret.geste) ret.geste.faire();
  dit(p3 && p3.frais === false && p3.groupes.length === GROUPES.length - 1 && ouverts.join() === 'cat_ventes', 'F6 app rouverte sur un autre onglet : les rangées gardées sont là, leur geste ouvre leur écran', { n: p3 && p3.groupes.length, ouverts });
  const R4 = await charger(F_REGLER, 'regler'); R4.brancherARegler({ uid: 'vendeur-a' });
  dit(R4.lireARegler(MAINTENANT + 13 * 3600000) === null, 'F7 au-delà de 12 h, le résumé gardé ne vaut plus rien (rien n’est montré)');
  const R5 = await charger(F_REGLER, 'regler'); R5.brancherARegler({ uid: 'vendeur-b' });
  dit(R5.lireARegler(MAINTENANT + 3600000) === null, 'F8 un autre vendeur sur le même appareil ne voit pas les rangées du premier');
  delete globalThis.localStorage;

  console.log('\n── S. La source');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const vue = ['src/natif/ecrans/Aujourdhui.jsx', 'src/designV2/Aujourdhui.jsx'].map((f) => path.join(RACINE, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
  dit(!/data-v2-job|data-v2-afaire|v2-afaire/.test(vue), 'S1 Aujourd’hui ne rend plus aucune rangée « À faire »');
  dit(/publierARegler\(/.test(vue), 'S2 Aujourd’hui PUBLIE ses groupes (src/designV2/aRegler.js)');
  dit(/chiffresAujourdhui\(\{/.test(app) && /alerteDuJour\(\{/.test(app) && /dernieresVentesFaites\(/.test(app), 'S3 l’app demande ses chiffres, son alerte et ses dernières ventes au modèle (aucune règle recopiée)');
  dit(/<ARegler onglet="argent"/.test(fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Compta.jsx'), 'utf8')) && /<ARegler onglet=\{t\}/.test(app) && /<ARegler onglet="stock"/.test(fs.readFileSync(path.join(RACINE, 'src', 'stockV2', 'StockV2.jsx'), 'utf8')) && /<ARegler onglet="sante"/.test(fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8')),
    'S4 le bloc « À régler » est branché en tête de Ventes, Achats, Annonces (une ligne), du Stock et de « Tout va bien ? »');
  dit(/ajoutPastille\('ventes'|plusRegler\('ventes'/.test(app) && /plusRegler\('stock'/.test(app), 'S5 les pastilles des onglets lisent la même publication');
  // (19 nov., audit d'utilité) Le plein d'Aujourd'hui IMPRIME : il demande `'imprimer'`, et le moteur des bordereaux de
  // Ventes fait alors le geste de SON plein (`imprimerLot()` si quelque chose part d'office), pas la seule feuille du choix.
  const pleinAuj = (app.match(/<AujourdhuiAvecChiffresV2[\s\S]*?\/>/) || [''])[0];
  dit(/plein=\{[^\n]*_pendingBordPrint = 'imprimer'/.test(pleinAuj) && /_pendingBordPrint==='imprimer'/.test(app) && /imprimerDOfficeRef\.current = \(\) => \{[^\n]*imprimerLot\(\); return true; \}/.test(app),
    'S6 « Imprimer N bordereaux » d’Aujourd’hui imprime (le geste du plein de Ventes), il ne fait pas qu’ouvrir Ventes');

  console.log(`\n${ko ? '❌' : '✅'} audit-aujourdhui${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit s’est arrêté : ' + String(e && e.stack || e).slice(0, 800)); process.exit(1); });
