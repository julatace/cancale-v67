// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : MA JOURNÉE, VENTES, ACHATS — LES ÉCARTS MESURÉS SUR SA BASE (6 nov.)
//   node scripts/audit-onglets-a.cjs [--mutation=sonde|encours|colis|aposter|frais|format|suspendue|segment|vc|relais|verifier|milliers|aide]
// ═══════════════════════════════════════════════════════════════════════════
// Ses données (copie lecture seule, hors dépôt) servies à l'app construite, chaque chiffre
// comparé à un recalcul indépendant. Chaque écart est reproduit ici sur des données
// INVENTÉES de la même forme (dépôt public) ; les règles pures sont EXÉCUTÉES, les
// branchements d'App.jsx jugés sur le code sans commentaires.
//  S. « 0 € aujourd'hui » : la coque ne relisait pas ses ventes quand la ligne
//     `orders_sold` était réécrite (src/sondeVentes.js, banc vendu-aujourdhui-relu).
//  E. La carte disait « pas lu » PENDANT la lecture (vendu absent = en cours).
//  C. « Colis envoyés 0 » : ses gestes « Colis fait » seuls (26 depuis l'été) ; des
//     ventes sans geste ⇒ « au moins » / « — », jamais 0.
//  P. « À envoyer — pas lu » (publication absente sur l'appareil) ⇒ le geste ; une
//     publication de plus de 12 h ne se croit pas (la règle du badge, une fonction).
//  F. « + 1772 à dater » ⇒ « + 1 772 à dater ».
//  T. Un achat « Transaction suspendue » compté « En route ».
//  G. Achats : « En route 28 » / « Arrivés 1,8 k » sous une carte qui les dit déjà.
//  V. Ventes · Tous : la vente Vestiaire sans montant alors que « vendu » la compte.
//  R. Achat au relais : « depuis 20 j » (âge de la commande) et « relance le vendeur ».
//  D. Ma journée : « + 34 à vérifier » et « Colis à vérifier · 34 délais dépassés ».
//  N. Le grand chiffre « 1514,33 € » au-dessus de « 2 122,93 € » (milliers).
//  A. « ? » de la carte : une phrase par chiffre, rangée avec sa définition.
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const src = { stats: lire('src/design/CarteStats.jsx'), sonde: lire('src/sondeVentes.js'), carte: lire('src/design/carteChiffres.js'), journal: lire('src/journalSemaine.js'), app: lire('src/App.jsx') };
const muter = (cle, avant, apres) => { if (!src[cle].includes(avant)) { console.log('❌ mutation impossible : ' + avant.slice(0, 90)); process.exit(2); } src[cle] = src[cle].replace(avant, apres); };
const MUTS = {
  sonde: ['sonde', 'if (cap > deja) out.push(uid);', ''],
  encours: ['carte', "if (V === undefined) return vide('encours', { p });", ''],
  colis: ['journal', "&& !Object.prototype.hasOwnProperty.call(notes, String(l.tx))).length : 0;", ').length * 0 : 0;'],
  aposter: ['carte', "if (!pub || !Number.isFinite(pub.total) || !publicationColisFraiche(pub, maintenant)) return vide('colis');", "if (!pub || !Number.isFinite(pub.total)) return vide('pasSu');"],
  frais: ['carte', 'maintenant - Number(pub.at) < PUB_COLIS_MAX_MS', 'true'],
  format: ['carte', "const nFr = (n) => Number(n).toLocaleString('fr-FR');", 'const nFr = (n) => String(n);'],
  suspendue: ['app', "if (/suspend/i.test(s)) return 'suspendue';", ''],
  segment: ['app', '{label}{cnt&&!dejaDit(id)?<span', '{label}{cnt?<span'],
  vc: ['app', 'prix: recuVc && recuVc.eur != null ? recuVc.eur : null, devise:', 'prix: null, devise:'],
  relais: ['app', '!cancelled && !st.retour && st.step>=1 && st.step<3 &&', '!cancelled && !st.retour && st.step>=1 && st.step<4 &&'],
  verifier: ['app', 'else if (j.detailSansN) j.detail = j.detailSansN;', ''],
  milliers: ['stats', '? montant(x.valeur) : euros(x.valeur)', '? fmt(x.valeur) : euros(x.valeur)'],
  aide: ['carte', "  vendu: 'Tes ventes de la période", "  vendux: 'Tes ventes de la période"],
};
if (MUT) { if (!MUTS[MUT]) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); } muter(...MUTS[MUT]); }
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `oa-${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte.replace(/from '(\.\.?\/[^']+)'/g, (m, f) => `from 'file://${path.resolve(path.join(R, 'src', nom === 'carte' ? 'design' : ''), f)}'`));
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};

(async () => {
  // ── S. La sonde des ventes de la coque ─────────────────────────────────────
  let S = null; try { S = src.sonde ? await charger(src.sonde, 'sonde') : null; } catch (_) { S = null; }
  if (!S || typeof S.comptesARelire !== 'function') { dit(false, 'S0. src/sondeVentes.js exporte `comptesARelire`'); S = { comptesARelire: () => [] }; }
  const rows = [
    { id: 'harvest_111_orders_sold', cap: '2026-11-06T10:22:03.441Z' },   // réécrite après la lecture de la coque
    { id: 'harvest_222_orders_sold', cap: '2026-11-05T14:11:36.974Z' },   // inchangée
    { id: 'harvest_333_orders_sold', cap: '2026-11-06T10:00:00Z' },        // jamais lue par la coque
    { id: 'harvest_444_orders_sold', cap: null },                          // date illisible
    { id: 'harvest_111_orders_purchased', cap: '2026-11-06T11:00:00Z' },  // pas une ligne de ventes
  ];
  const vus = { 111: Date.parse('2026-11-05T14:11:36.974Z'), 222: Date.parse('2026-11-05T14:11:36.974Z'), 444: 1 };
  const a = S.comptesARelire(rows, vus);
  dit(a.join() === '111', 'S1. la ligne de ventes réécrite après la lecture de la coque est relue — seule', JSON.stringify(a));
  dit(S.comptesARelire(rows, vus, ['222']).length === 0, 'S2. un compte hors des comptes liés n’est pas relu');
  dit(S.comptesARelire(null, vus).length === 0 && S.comptesARelire(rows, null).length === 0, 'S3. rien lu ⇒ rien relu (jamais « pas su » pris pour « nouveau »)');
  const app = sansCommentaires(src.app);
  dit(/const sonde = async \(\) => \{[\s\S]{0,400}comptesARelire\(rows, capVentesCoque\.current[\s\S]{0,200}relireVentesCompte\(uid\)/.test(app), 'S4. la coque relit ses ventes par sa sonde (pas seulement sur un signal de l’extension)');
  dit(/perAccRef\.current = \{ \.\.\.perAccRef\.current, perAcc: perAccRef\.current\.perAcc\.map\(/.test(app), 'S5. la relecture d’un compte remplace aussi la lecture gardée pour les signaux d’annonces');

  // ── E, P, F. La carte des chiffres ─────────────────────────────────────────
  const M = await charger(src.carte, 'carte');
  const MAINT = new Date(2026, 10, 6, 11, 10).getTime();
  const regles = { bilanLignes: (l, de, a) => { let n = 0, eur = 0; for (const x of l) { if (x.ts < de || (a != null && x.ts > a)) continue; n++; eur += x.eur; } return { n, eur }; },
    debutPeriode: (t, p) => { const d = new Date(t); d.setHours(0, 0, 0, 0); if (p === 'mois') d.setDate(1); return d; }, decalerPeriode: (d) => d, fmt: (v) => String(v), rythmeVendu: () => null, chiffreBenefice: () => ({ valeur: null }), chiffreBrut: () => ({ valeur: null }), beneficeDesJours: () => ({}) };
  const sources = (x) => ({ vendu: undefined, beneficeDe: () => ({ B: null, etat: 'encours' }), joursBenef: null, etatBenef: 'encours', ligneUrssaf: null, colisAPoster: null, colisARetirer: null, dorment: null, live: null, ...x });
  const V = (id, src0, p) => M.valeurChiffre(id, { id, p }, src0, { site: 'toutes', compte: null, periode: null }, regles, MAINT);
  const enCours = V('vendu', sources({ vendu: undefined }), 'mois');
  dit(enCours.valeur == null && M.raisonCourte(enCours) === 'lecture…', 'E1. ventes de la coque pas encore là : « lecture… », jamais « pas lu »', M.raisonCourte(enCours));
  const pasSu = V('vendu', sources({ vendu: null }), 'mois');
  dit(pasSu.valeur == null && M.raisonCourte(pasSu) === 'pas lu', 'E2. ventes pas sues (null) : « pas lu »', M.raisonCourte(pasSu));
  const lu = V('vendu', sources({ vendu: { lignes: [{ plateforme: 'Vinted', ts: MAINT - 3600e3, eur: 50 }], manque: [], nonComptees: [] } }), 'jour');
  dit(lu.valeur === 50, 'E3. lu : la valeur', JSON.stringify(lu.valeur));
  const absente = V('aposter', sources({ colisAPoster: null }));
  dit(absente.valeur == null && M.raisonCourte(absente) === 'ouvre Colis', 'P1. « À envoyer » pas compté sur cet appareil : le geste (« ouvre Colis »), pas « pas lu »', M.raisonCourte(absente));
  const vieille = V('aposter', sources({ colisAPoster: { total: 11, vinted: 10, ebay: 0, leboncoin: 0, vestiaire: 1, at: MAINT - 13 * 3600e3 } }));
  dit(vieille.valeur == null, 'P2. une publication de plus de 12 h ne se croit pas (la règle du badge de Colis)', JSON.stringify(vieille.valeur));
  const fraiche = V('aposter', sources({ colisAPoster: { total: 11, vinted: 10, ebay: 0, leboncoin: 0, vestiaire: 1, at: MAINT - 3600e3 } }));
  dit(fraiche.valeur === 11, 'P3. fraîche : 11', JSON.stringify(fraiche.valeur));
  dit(typeof M.publicationColisFraiche === 'function' && M.publicationColisFraiche({ at: MAINT - 11 * 3600e3 }, MAINT) && !M.publicationColisFraiche({ at: MAINT - 13 * 3600e3 }, MAINT), 'P4. une seule fonction de fraîcheur (12 h)');
  dit(/publicationColisFraiche\(pub\)\) \? pub\.total : null/.test(app), 'P5. le badge de Colis lit la MÊME fonction');
  const ad = M.raisonCourte({ valeur: 315.4, aDater: 1772 });
  dit(/^\+ 1\s772 à dater$/.test(ad), 'F1. « + 1 772 à dater » (un nombre de ventes écrit comme les autres)', ad);

  // ── C. Colis envoyés de la semaine ─────────────────────────────────────────
  const J = await charger(src.journal, 'journal');
  const lundi = new Date(2026, 9, 26).getTime(), fin = new Date(2026, 10, 2).getTime();
  const RG = { semainePassee: () => ({ lundi: '2026-10-26', dimanche: '2026-11-01', debut: lundi, fin }), bilanLignes: regles.bilanLignes, beneficeDesJours: () => ({}), chiffreBrut: () => ({ valeur: null }) };
  const T = (j, h = 12) => new Date(2026, 9, j, h).getTime();
  const lignes = [{ plateforme: 'Vinted', tx: '1', ts: T(27), eur: 60 }, { plateforme: 'Vinted', tx: '2', ts: T(22), eur: 40 }, { plateforme: 'Vinted', tx: '3', ts: T(10), eur: 30 }];
  const vide = { vinted: {}, lbc: {}, vc: {} };
  const J0 = J.journalSemaine({ maintenant: fin + 3600e3, vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: null, colisFaits: vide, R: RG });
  dit(J0.colis.valeur == null && J0.colis.raison === 'nonNotes', 'C1. des ventes de la semaine (et des 7 jours d’avant) sans geste : « — » (envois pas notés), jamais « 0 »', JSON.stringify(J0.colis));
  const J1 = J.journalSemaine({ maintenant: fin + 3600e3, vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: null, colisFaits: { vinted: { 1: T(28) }, lbc: {}, vc: {} }, R: RG });
  dit(J1.colis.valeur === 1 && J1.colis.partiel, 'C2. un geste, une vente sans geste : « au moins 1 »', JSON.stringify(J1.colis));
  const J2 = J.journalSemaine({ maintenant: fin + 3600e3, vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: null, colisFaits: { vinted: { 1: T(28), 2: T(23), 3: T(11) }, lbc: {}, vc: {} }, R: RG });
  dit(J2.colis.valeur === 1 && !J2.colis.partiel, 'C3. chaque vente notée (avant ou pendant) : le nombre exact', JSON.stringify(J2.colis));
  const J3 = J.journalSemaine({ maintenant: fin + 3600e3, vendu: undefined, joursBenef: null, colisFaits: vide, R: RG });
  dit(J3.colis.valeur == null && J3.colis.raison === 'encours' && J3.ventes.raison === 'encours', 'C4. ventes en cours de lecture : « lecture… »', JSON.stringify(J3.colis));
  dit(M.raisonCourte({ valeur: null, raison: 'nonNotes' }) === 'envois pas notés', 'C5. la raison se dit (« envois pas notés »)');

  // ── T, G, V, R, D. Les branchements d'App.jsx ──────────────────────────────
  const fnPhase = (/const phaseReception = \(o\) => \{([\s\S]*?)\n  \};/.exec(app) || [])[1] || '';
  let phase = null;
  try { phase = new Function('isAtRelayStatus', 'purchasePhase', `return (o) => {${fnPhase}};`)((s) => /point relais|déposé/i.test(s), (s) => /finalis|livr/i.test(s) ? 'completed' : 'x'); } catch (_) { phase = null; }
  dit(!!phase && phase({ status: 'Transaction suspendue - en attente de vérification.' }) !== 'route', 'T1. un achat « Transaction suspendue » n’est pas « en route »', phase ? phase({ status: 'Transaction suspendue - en attente de vérification.' }) : 'phaseReception introuvable');
  dit(!!phase && phase({ status: "Commande expédiée et en cours d'acheminement ! " }) === 'route', 'T2. un achat expédié reste « en route »');
  dit(/surCarte = \(dansPlateforme && !baseKO\) \? idsCarteAchats\(\) : null/.test(app) && /\{label\}\{cnt&&!dejaDit\(id\)\?<span/.test(app), 'G1. un onglet d’Achats ne redit pas un nombre que la carte du haut montre');
  dit(/prix: recuVc && recuVc\.eur != null \? recuVc\.eur : null, devise:/.test(app) && /const recuVc = montantRecuVc\(v\);/.test(app), 'V1. la vente Vestiaire de Ventes · Tous porte le montant que « vendu » compte');
  dit(/st\.step===3 && \(\(\)=>\{ const a=Date\.parse\(\(tk&&tk\.arriveLe\)\|\|''\)/.test(app) && /st\.step>=1 && st\.step<3 &&/.test(app), 'R1. au relais : le temps AU RELAIS (arrivée lue), jamais « relance le vendeur »');
  dit(/else if \(j\.detailSansN\) j\.detail = j\.detailSansN;/.test(app), 'D1. « à vérifier » dit une fois : la ligne garde ses raisons sans le nombre de la case');

  // ── N, A. La carte ────────────────────────────────────────────────────────
  dit(/\? montant\(x\.valeur\) : euros\(x\.valeur\)/.test(src.stats), 'N1. le grand chiffre sépare les milliers (« 1 514,33 € »)');
  const sansAide = M.IDS_CHIFFRES.filter((id) => !(M.AIDE_CHIFFRES && typeof M.AIDE_CHIFFRES[id] === 'string' && M.AIDE_CHIFFRES[id].length > 20));
  dit(!sansAide.length, 'A1. chaque chiffre de la carte a sa phrase « d’où il vient »', sansAide.join(', '));
  dit(/aide \? <button type="button" className="vrm-fu-aide"/.test(src.stats) && /function FeuilleAide/.test(src.stats), 'A2. la carte porte le « ? » (sur demande de la page) et sa feuille');
  dit((app.match(/<CarteStatsApp page=("[^"]+"|\{plateforme\}) aide /g) || []).length >= 6, 'A3. Ma journée, Ventes (tous les sites, Vinted, Leboncoin/eBay, Vestiaire) et Achats demandent le « ? »', String((app.match(/<CarteStatsApp page=("[^"]+"|\{plateforme\}) aide /g) || []).length));
  console.log(`${ko ? '❌' : '✅'} audit-onglets-a : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit-onglets-a : ' + e.message); process.exit(1); });
