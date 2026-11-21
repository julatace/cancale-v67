// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — ARGENT PLUS (15 nov., lot argent-plus)
//  Il EXÉCUTE (esbuild → CommonJS, puis require) les règles pures du lot :
//   A. le bilan de fin de mois : `urssafDuBilan`, `lignesFinMois`, `bilanDuMois`
//      (+ `enPlus`), le tableur `lignesTableurBilan`, le PDF ; côté serveur
//      `notifBilanDuMois` / `passeBilanMoisPush` (le VRAI calcul `calculerBilanMois`
//      sur une base inventée) et la rédaction `bilanMois` (5 langues, 40 / 90) ;
//   B. les seuils : `alertesSeuils`, `alertesADire`, `texteSeuil`, `passeSeuilsPush`
//      (le régime jamais deviné, « plus de 2 000 € », une fois chacune, sources) ;
//   C. le bénéfice par article : `beneficeArticle` = `beneficeLigneVente` sur le VERSÉ
//      (mille tirages au centime), eBay / Vestiaire / Leboncoin, `beneficeListe`
//      (jamais « au moins »), la fiche (`parcoursPaire` : eBay retire aussi les frais saisis) ;
//   D. la sauvegarde : motifs = ceux du serveur, `lireSauvegarde` sur une fausse base
//      (owner partout, jamais `data` sur une ligne lourde, une page ratée NOMMÉE), le zip
//      relu (un dossier, JSON, CSV, PDF, aucun secret) ;
//   E. le texte : jamais « encaissé », chaque clé `argentPlus.*` dans les 5 langues.
//  `--mutation` : chaque mutation réaffaiblit une règle ; l'audit doit rougir sur CHACUNE.
//  `node scripts/audit-argent-plus.cjs [--mutation]`
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const MUTATIONS = {
  au_moins_zero:   ['src/bilanFinMois.js', '  if (montant.partiel && !(a > 0)) return { etat: \'passu\', apayer: null, auMoins: false, regime };\n', ''],
  regime_devine:   ['src/bilanFinMois.js', "  if (regime == null) return { etat: 'regime', apayer: null, auMoins: false, regime: null };", "  if (regime == null) regime = 'micro';"],
  dorment_zero:    ['src/bilanFinMois.js', 'const valeur = su && !(dorment.auMoins && !(Number(dorment.n) > 0)) ? Number(dorment.n) : null;', 'const valeur = su ? Number(dorment.n) : null;'],
  seuil_80:        ['src/alertesSeuils.js', 'export const PALIER_PROCHE = 80;', 'export const PALIER_PROCHE = 70;'],
  seuil_egal:      ['src/alertesSeuils.js', 'const depasse = Math.round(cur.ca * 100) > Math.round(montant * 100);', 'const depasse = Math.round(cur.ca * 100) >= Math.round(montant * 100);'],
  seuil_regime:    ['src/alertesSeuils.js', "  if (regime === 'micro' && s) {", '  if (s) {'],
  seuil_deux_fois: ['src/alertesSeuils.js', '    if (!a || dit.has(a.cle)) continue;', '    if (!a) continue;'],
  benef_ebay_vente:['src/beneficeArticle.js', '  const recuC = sansCommission ? venteC : (autreDevise ? null : cts(recu));', '  const recuC = sansCommission ? venteC : (autreDevise ? null : (cts(recu) == null ? venteC : cts(recu)));'],
  benef_au_plus:   ['src/beneficeArticle.js', '  return { n: L.length, nCompte, nAuPlus, auPlus: nAuPlus > 0,', '  return { n: L.length, nCompte, nAuPlus, auPlus: false,'],
  fiche_ebay:      ['src/fichePaire.js', "      if (detailBenef.benefice != null) { benefice = detailBenef.benefice; benefPartiel = detailBenef.etat === 'partiel'; }\n      else raisonBenef = RAISON_ARTICLE[detailBenef.etat] || 'frais illisibles';\n      etapes.push({ cle: 'argent', etat: 'fait', titre: 'Argent reçu sur eBay'", "      if (achatC != null) benefice = venteC - achatC; else raisonBenef = 'prix d’achat pas saisi';\n      etapes.push({ cle: 'argent', etat: 'fait', titre: 'Argent reçu sur eBay'"],
  svg_owner:       ['src/sauvegardeDonnees.js', "  const o = owner ? `owner=eq.${encodeURIComponent(owner)}&` : '';", "  const o = '';"],
  svg_lourds:      ['src/sauvegardeDonnees.js', "export const LOURDS = ['harvest_*_txn_*', 'harvest_*_label_*', 'email_bord_*',", "export const LOURDS = ['harvest_*_txn_*', 'harvest_*_label_*',"],
  svg_rate_tu:     ['src/sauvegardeDonnees.js', "    if (!Array.isArray(l)) { out.manques.push(`${Math.min(LOT, legeres.length - i)} lignes`); continue; }", '    if (!Array.isArray(l)) continue;'],
  push_sans_memo:  ['api/_lib/argent-passes.js', "  if (!res || !res.reserve) return res && res.raison === 'deja' ? 'déjà envoyé' : 'mémo illisible — rien';\n  const fr = rediger(n.redaction", "  const fr = rediger(n.redaction"],
};

let ok = 0, ko = 0, SILENCE = false;
const journal = [];
const dit = (bon, quoi, det) => { if (bon) ok++; else { ko++; journal.push(quoi); } if (!SILENCE) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const texte = (f, m) => { const t = lire(f); if (!m || m[0] !== f) return t; if (!t.includes(m[1])) throw new Error(`motif de mutation absent dans ${f}`); return t.replace(m[1], m[2]); };

async function charger(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ap-'));
  const src = (f) => JSON.stringify(path.join(R, f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
export * as BF from ${src('src/bilanFinMois.js')};
export * as BM from ${src('src/bilanMois.js')};
export * as AS from ${src('src/alertesSeuils.js')};
export * as BA from ${src('src/beneficeArticle.js')};
export * as BL from ${src('src/beneficeLigne.js')};
export * as FP from ${src('src/fichePaire.js')};
export * as SV from ${src('src/sauvegardeDonnees.js')};
export * as ED from ${src('src/exportDonnees.js')};
export * as AN from ${src('api/_lib/argent-notif.js')};
export * as AP from ${src('api/_lib/argent-passes.js')};
export * as NR from ${src('api/_lib/notif-redaction.js')};
export * as UR from ${src('api/_lib/urssaf-regle.js')};
export * as BMS from ${src('api/_lib/bilan-mois.js')};
export * as RG from ${src('api/_lib/export-rgpd.js')};
`);
  const plugins = mutation ? [{ name: 'mutant', setup(b) {
    const cible = path.join(R, mutation[0]);
    b.onLoad({ filter: /\.(jsx?)$/ }, (a) => (path.resolve(a.path) !== cible ? undefined : { contents: texte(mutation[0], mutation), loader: 'jsx' }));
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx', '.css': 'empty' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  const M = require(path.join(dir, 'sortie.cjs'));
  return { M, dir };
}

const iso = (s) => new Date(s).toISOString();
async function verifier(mutation) {
  const { M, dir } = await charger(mutation);
  const { BF, BM, AS, BA, BL, FP, SV, ED, AN, AP, NR, UR, BMS, RG } = M;
  const T = (k, v) => (v ? `${k}${JSON.stringify(v)}` : k);

  // ═══ A. LE BILAN DE FIN DE MOIS ═══
  const u0 = BF.urssafDuBilan({ regime: null });
  dit(u0.etat === 'regime' && u0.apayer == null, 'A1 aucun régime choisi ⇒ « choisis ton régime », aucun montant (jamais deviné)', JSON.stringify(u0));
  dit(BF.urssafDuBilan({ regime: undefined }).etat === 'encours' && BF.urssafDuBilan({ regime: 'particulier', montant: { apayer: 50 } }).etat === 'autre', 'A1 régime pas encore lu ⇒ « en cours » ; particulier ⇒ aucune cotisation micro');
  const uz = BF.urssafDuBilan({ regime: 'micro', montant: { ca: 0, apayer: 0, partiel: true } });
  dit(uz.etat === 'passu' && uz.apayer == null, 'A1 « au moins 0,00 € » ne se dit jamais (minimum nul ⇒ « — »)', JSON.stringify(uz));
  // Le montant du mois : la VRAIE règle `montantPeriodeUrssaf` (miroir de l'app) sur une ligne publiée.
  const ligneU = { at: Date.parse('2026-11-01T08:00:00+01:00'), mois: [{ ym: '2026-10', ca: 1000, n: 10 }, { ym: '2026-09', ca: 500, n: 5 }], sources: {} };
  const mont = UR.montantPeriodeUrssaf({ periodStart: new Date(2026, 9, 1), periodEnd: new Date(2026, 10, 0) }, ligneU, 12.4);
  const us = BF.urssafDuBilan({ regime: 'micro', montant: mont });
  dit(us.etat === 'su' && us.apayer === UR.aPayerUrssaf(1000, 12.4) && us.auMoins === false, 'A2 URSSAF du mois = `aPayerUrssaf` du CA déclaré du MOIS (la règle de la carte et du rappel)', JSON.stringify({ us, mont }));
  const ligneTot = { ...ligneU, at: Date.parse('2026-10-28T08:00:00+01:00') };
  const us2 = BF.urssafDuBilan({ regime: 'micro', montant: UR.montantPeriodeUrssaf({ periodStart: new Date(2026, 9, 1), periodEnd: new Date(2026, 10, 0) }, ligneTot, 12.4) });
  dit(us2.etat === 'su' && us2.auMoins === true, 'A2 ligne publiée avant la fin du mois ⇒ « au moins » (la règle le dit)', JSON.stringify(us2));
  const L1 = BF.lignesFinMois({ urssaf: u0, dorment: { etat: 'pas-su', n: null } }, T);
  dit(L1.find((l) => l.cle === 'urssaf').geste === 'regime' && L1.find((l) => l.cle === 'dorment').valeur === null, 'A3 la ligne URSSAF porte le geste « choisir mon régime » ; qui dorment pas su ⇒ « — »');
  const L2 = BF.lignesFinMois({ dorment: { etat: 'su', n: 0, auMoins: true } }, T);
  dit(L2[0].valeur === null, 'A3 « au moins 0 » article qui dort ne se dit pas', JSON.stringify(L2[0]));
  const L3 = BF.lignesFinMois({ urssaf: us, dorment: { etat: 'su', n: 12, auMoins: false } }, T);
  const D = BM.bilanDuMois({ ym: '2026-10', vendu: { n: 4, eur: 400.5, manque: [] }, recu: { valeur: 380.5, partiel: false, manque: [] }, depense: 12, benefice: { valeur: 120, raison: '' }, B: { n: 4, nCout: 4 }, meilleur: { nom: 'a', n: 2, eur: 300, parmi: 2 }, enPlus: L3 });
  const lg = (k) => D.lignes.find((l) => l.cle === k);
  dit(lg('urssaf') && lg('urssaf').valeur === us.apayer && lg('dorment') && lg('dorment').valeur === 12 && lg('vendu').valeur === 400.5, 'A4 le bilan porte l’URSSAF du mois et les articles qui dorment, à côté des lignes d’avant');
  const tab = BF.lignesTableurBilan(D, T);
  const csv = ED.lireCsv(ED.csvDe(tab));
  const val = (nom) => (csv.find((l) => l[0] === nom) || [])[1];
  dit(csv.length === D.lignes.length + 2 && val(lg('vendu').nom) === '400,50' && val(lg('urssaf').nom) === us.apayer.toFixed(2).replace('.', ',') && val(lg('dorment').nom) === '12', 'A4 le tableur dit les MÊMES valeurs que la carte (une ligne par chiffre + le meilleur compte)', JSON.stringify(csv));
  const tabV = BF.lignesTableurBilan(BM.bilanDuMois({ ym: '2026-10', vendu: { n: 0, eur: 0, manque: ['eBay'] }, enPlus: BF.lignesFinMois({ urssaf: uz }, T) }), T);
  dit(tabV.filter((l) => l[1] === '0,00' && /vendu|urssaf/i.test(l[0])).length === 0, 'A4 tableur : un « pas su » s’écrit vide, jamais 0,00', JSON.stringify(tabV));
  try {
    const pdf = await BM.pdfBilanMois(D, { fmt: (x) => `${x} €` });
    dit(pdf && pdf.length > 800 && pdf[0] === 0x25 && pdf[1] === 0x50, 'A5 le PDF du bilan se fabrique avec les nouvelles lignes');
  } catch (e) { dit(false, 'A5 le PDF du bilan se fabrique', e.message); }
  // Le serveur : le VRAI calcul du bilan du mois (base inventée, octobre 2026).
  const orders = [
    { transaction_id: 101, title: 'Inventée 1', status: 'Commande finalisée', date: iso('2026-10-01T10:00:00+02:00'), price: { amount: '80.0' } },
    { transaction_id: 102, title: 'Inventée 2', status: 'Commande finalisée', date: iso('2026-10-14T12:00:00+02:00'), price: { amount: '215.5' } },
  ];
  const Tm = Date.parse('2026-11-01T06:00:00+01:00');
  const d = { comptes: [{ uid: 'A', login: 'vendeuse_inventee' }], commandes: { A: { orders, cap: iso('2026-11-01T05:00:00+01:00') } }, masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, exclusAutres: {}, lbc: [], ebay: [], vestiaire: [],
    versements: { 101: iso('2026-10-05T10:00:00+02:00'), 102: iso('2026-11-02T10:00:00+01:00') } };
  const mainS = { vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_mois: { at: Tm, mois: [{ ym: '2026-10', ca: 80, n: 1 }], sources: {} }, vrm_paires_dorment: { n: 7, total: 20, datesKnown: 20, at: Tm - 3600000 } };
  const mois = BMS.moisPasse(Tm);
  const n = AP.notifBilanDuMois({ d, pub: null, main: mainS, mois, maintenant: Tm });
  const b = BMS.calculerBilanMois({ d, pub: null, mois, maintenant: Tm });
  dit(n.envoyer && n.redaction.vendu.eur === b.vendu.eur && n.redaction.recu.eur === b.recu.eur && b.vendu.eur === 295.5 && b.recu.eur === 80, 'A6 la notification dit le vendu et le reçu de `calculerBilanMois` (au jour de la vente / du versement)', JSON.stringify({ r: n.redaction, v: b.vendu, rc: b.recu }));
  dit(n.redaction.urssaf.etat === 'su' && n.redaction.urssaf.apayer === UR.aPayerUrssaf(80, 12.4) && n.redaction.dorment.n === 7, 'A6 + l’URSSAF du mois (même règle) et les articles qui dorment (`dormentDe`)', JSON.stringify(n.redaction));
  dit(/[?&]tab=compta/.test(n.url) && /cible=bilanmois/.test(n.url) && /mois=2026-10/.test(n.url), 'A6 elle ouvre Argent → « Bilan du mois » sur CE mois', n.url);
  const nR = AP.notifBilanDuMois({ d, pub: null, main: { ...mainS, vinted_regime: undefined }, mois, maintenant: Tm });
  dit(nR.redaction.urssaf.etat === 'regime', 'A6 régime jamais choisi ⇒ « choisis ton régime » (rien deviné)', JSON.stringify(nR.redaction.urssaf));
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = NR.rediger(n.redaction, { langue: l, maintenant: Tm });
    dit(t && t.title.length <= 40 && t.body.length <= 90 && t.body.length > 10 && !/encaiss/i.test(t.title + t.body) && !/au moins 0[ ,]/.test(t.body), `A7 rédaction ${l} : titre ≤ 40, corps ≤ 90, jamais « encaissé »`, JSON.stringify(t));
  }
  // La passe : une fois par mois, réservée AVANT l'envoi.
  const passe = async ({ dedup = null, reserve = true, actif = true, quand = Tm, illisible = false } = {}) => {
    const envois = []; let lus = 0;
    const r = await AP.passeBilanMoisPush({ maintenant: quand, actif: async () => actif, lireDedup: async () => (illisible ? undefined : dedup),
      reserver: async () => (reserve ? { reserve: true } : { reserve: false, raison: 'pas-su' }), lireDonnees: async () => { lus++; return d; }, lirePub: async () => null, lireMain: async () => mainS, pousser: async (p) => { envois.push(p); return { sent: 1 }; } });
    return { r, envois, lus };
  };
  const p1 = await passe();
  dit(p1.envois.length === 1 && p1.envois[0].cat === 'bilan' && p1.envois[0].redaction && p1.envois[0].redaction.sorte === 'bilanMois', 'A8 le 1er : une notification « bilan » (texte refait dans la langue du vendeur)', JSON.stringify(p1));
  dit(!JSON.stringify(p1.r).match(/\d+[.,]\d+|295|80/), 'A8 la réponse du cron ne porte aucun montant', JSON.stringify(p1.r));
  dit((await passe({ dedup: { mois: '2026-10' } })).envois.length === 0, 'A8 déjà envoyée ce mois ⇒ rien');
  dit((await passe({ illisible: true })).envois.length === 0, 'A8 mémo illisible ⇒ rien (« pas su » ≠ « jamais envoyé »)');
  dit((await passe({ reserve: false })).envois.length === 0, 'A8 réservation non confirmée ⇒ rien');
  dit((await passe({ actif: false })).envois.length === 0, 'A8 coupée par le vendeur ⇒ rien');
  const p8 = await passe({ quand: Date.parse('2026-11-08T06:00:00+01:00') });
  dit(p8.r === null && p8.lus === 0 && p8.envois.length === 0, 'A8 après le 7 : rien n’est lu, rien ne part');

  // ═══ B. LES SEUILS ═══
  const ligneDe = (moisCa, extra = {}) => ({ at: Date.parse('2026-11-10T08:00:00+01:00'), sources: {}, mois: moisCa.map(([ym, ca, par]) => ({ ym, ca, n: 1, par: par || {} })), ...extra });
  const now = new Date(2026, 10, 15, 12);
  const a1 = AS.alertesSeuils({ ligne: ligneDe([['2026-03', 90000], ['2026-07', 80000]]), now, regime: 'micro' });
  const cle = (a) => a.map((x) => x.cle).sort().join(' ');
  dit(cle(a1) === '2026:micro:80 2026:tva:100 2026:tvaMajore:100', 'B1 170 000 € : 80 % du plafond micro, TVA 85 000 € et 93 500 € dépassées', cle(a1));
  dit(AS.alertesSeuils({ ligne: ligneDe([['2026-03', 170000]]), now, regime: null }).length === 0 && AS.alertesSeuils({ ligne: ligneDe([['2026-03', 170000]]), now, regime: 'societe' }).length === 0, 'B2 régime pas choisi (ou société) ⇒ aucune alerte micro ni TVA (jamais deviné)');
  dit(AS.alertesSeuils({ ligne: ligneDe([['2026-03', 85000]]), now, regime: 'micro' }).find((a) => a.seuil === 'tva').palier === 80, 'B3 85 000,00 € pile ne « dépasse » pas le seuil de TVA (palier 80)');
  dit(AS.alertesSeuils({ ligne: ligneDe([['2026-03', 67000]]), now, regime: 'micro' }).length === 0 && AS.alertesSeuils({ ligne: ligneDe([['2026-03', 68000]]), now, regime: 'micro' }).some((a) => a.cle === '2026:tva:80'), 'B3 80 % de 85 000 € = 68 000 € : en dessous rien, à 68 000 € l’alerte');
  const dac = (n, ca, ex = {}) => AS.alertesSeuils({ ligne: ligneDe([['2026-03', ca, { Vinted: { n, ca } }]], ex), now, regime: null }).filter((a) => a.seuil === 'dac7');
  dit(dac(24, 300).map((a) => a.palier).join() === '80' && dac(30, 300).map((a) => a.palier).join() === '100' && dac(23, 300).length === 0, 'B4 DAC7 : 24 ventes ⇒ 80 %, 30 ventes ⇒ atteint, 23 ⇒ rien');
  dit(dac(5, 2000).map((a) => a.palier).join() === '80' && dac(5, 2000.01).map((a) => a.palier).join() === '100', 'B4 DAC7 : 2 000,00 € pile n’atteint pas (« plus de 2 000 € »), 2 000,01 € oui');
  dit(AS.alertesSeuils({ ligne: ligneDe([['2026-03', 300, { Vinted: { n: 3, ca: 300 } }]], { sources: { Vinted: 'pasSu' } }), now, regime: null }).length === 0, 'B4 une plateforme pas lue ⇒ aucune alerte DAC7');
  const part = AS.alertesSeuils({ ligne: ligneDe([['2026-03', 170000]], { aDater: { n: 3, ca: 100 } }), now, regime: 'micro' });
  dit(part.length === 3 && part.every((a) => a.auMoins), 'B4 CA partiel : un minimum au-dessus d’un palier l’atteint, dit « au moins »');
  dit(AS.alertesSeuils({ ligne: ligneDe([['2027-03', 170000]]), now: new Date(2027, 5, 1), regime: 'micro' }).length === 0, 'B5 une année sans seuils vérifiés ⇒ aucune alerte micro/TVA (jamais un plafond périmé)');
  const aD = AS.alertesADire(a1, { '2026:micro:80': 1 });
  dit(aD.length === 2 && !aD.some((a) => a.cle === '2026:micro:80'), 'B6 une fois chacune : un palier déjà dit ne revient pas', cle(aD));
  const t100 = AS.alertesADire(a1, {}).find((a) => a.cle === '2026:tva:100');
  dit(t100 && t100.marquer.join() === '2026:tva:80,2026:tva:100', 'B6 100 % atteint d’un coup : une seule alerte, les deux paliers rangés', JSON.stringify(t100 && t100.marquer));
  dit(AS.alertesADire(a1, AS.vuesAvec({}, a1.flatMap((a) => AS.alertesADire([a], {})[0].marquer))).length === 0, 'B6 tout rangé ⇒ plus rien à dire');
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const tous = [...a1, ...dac(30, 300), ...dac(24, 300), ...AS.alertesSeuils({ ligne: ligneDe([['2026-03', 210000]]), now, regime: 'micro' })];
    const ts = tous.map((a) => AS.texteSeuil(a, l));
    dit(ts.every((t) => t && t.titre.length <= 40 && t.court.length <= 90 && t.phrase.length > 20 && /^https:\/\/(entreprendre\.service-public\.gouv\.fr|eur-lex\.europa\.eu)\//.test(t.url) && !/encaiss/i.test(t.phrase + t.court)), `B7 phrases ${l} : titre ≤ 40, court ≤ 90, une source officielle par alerte`, JSON.stringify(ts.filter((t) => !t || t.titre.length > 40 || t.court.length > 90).slice(0, 2)));
  }
  dit(/deux années de suite/.test(AS.texteSeuil(a1.find((a) => a.seuil === 'micro'), 'fr').phrase) && /dès le jour du dépassement/.test(AS.texteSeuil(a1.find((a) => a.seuil === 'tvaMajore'), 'fr').phrase), 'B7 la phrase dit le texte officiel (deux années de suite ; TVA dès le jour du dépassement)');
  // La passe des seuils : une fois chacune, réservée avant l'envoi.
  const mainSe = { vinted_regime: 'micro', vinted_urssaf_mois: ligneDe([['2026-03', 90000], ['2026-07', 80000]]) };
  const passeS = async (dedup, { reserve = true, main = mainSe } = {}) => { const envois = []; let memo = dedup;
    const r = await AP.passeSeuilsPush({ maintenant: Date.parse('2026-11-15T06:00:00+01:00'), actif: async () => true, lireDedup: async () => memo, reserver: async (deja, nouveau) => (reserve ? (memo = nouveau(memo), { reserve: true }) : { reserve: false, raison: 'pas-su' }), lireMain: async () => (main === 'illisible' ? undefined : main), pousser: async (p) => { envois.push(p); } });
    return { r, envois, memo }; };
  const s1 = await passeS(null);
  dit(s1.envois.length === 3 && s1.envois.every((e) => e.cat === 'seuil' && e.title.length <= 40 && e.body.length <= 90), 'B8 trois seuils atteints ⇒ trois notifications (≤ 40 / ≤ 90)', JSON.stringify(s1.envois.map((e) => [e.title, e.body])));
  dit((await passeS(s1.memo)).envois.length === 0, 'B8 le lendemain ⇒ rien (une fois chacune)');
  dit((await passeS(undefined)).envois.length === 0 && (await passeS(null, { reserve: false })).envois.length === 0 && (await passeS(null, { main: 'illisible' })).envois.length === 0, 'B8 mémo ou réglages illisibles, réservation ratée ⇒ rien');
  dit(!/\d{4,}|€|\d[.,]\d/.test(JSON.stringify(s1.r).replace(/2026/g, '')), 'B8 la réponse du cron ne porte aucun montant', JSON.stringify(s1.r));
  dit(AP.nowParis(Date.parse('2026-12-31T23:30:00Z')).getFullYear() === 2027, 'B9 l’année civile est celle de Paris (31 déc. 23 h 30 UTC = 2027)');

  // ═══ C. LE BÉNÉFICE PAR ARTICLE ═══
  const e1 = { buyPrice: '20', fees: '3', fraisComplets: true };
  const v1 = BA.beneficeArticle({ plateforme: 'Vinted', vente: '50.0', entree: e1 });
  dit(v1.etat === 'ok' && v1.benefice === 2700 && v1.fraisSite === 0, 'C1 Vinted : 50 − 0 (aucune commission) − 3 − 20 = 27 €', JSON.stringify(v1));
  const v2 = BA.beneficeArticle({ plateforme: 'Vinted', vente: '50.0', entree: { buyPrice: '20', fees: '3' } });
  dit(v2.etat === 'partiel' && v2.benefice === 2700 && v2.manque.includes('frais'), 'C1 frais pas confirmés ⇒ « au plus », le manque nommé', JSON.stringify(v2));
  let ecarts = 0;
  for (let i = 0; i < 1000; i++) {
    const x = (Math.floor(Math.random() * 30000) / 100).toFixed(2), e = { buyPrice: i % 7 ? (Math.floor(Math.random() * 20000) / 100).toFixed(2) : '', fees: (Math.floor(Math.random() * 900) / 100).toFixed(2), emballage: i % 3 ? '1,20' : '', fraisComplets: i % 2 === 0 };
    const a = BA.beneficeArticle({ plateforme: 'Vinted', vente: x, entree: e }), r = BL.beneficeLigneVente(x, e);
    const attendu = r.benefice == null ? null : Math.round(r.benefice * 100);
    if (a.benefice !== attendu || (r.etat !== a.etat)) ecarts++;
    if (a.benefice != null && a.vente - a.fraisSite - a.saisis - a.achat !== a.benefice) ecarts++;
  }
  dit(ecarts === 0, 'C2 mille tirages : le bénéfice = `beneficeLigneVente` au centime, et vente − site − saisis − achat = bénéfice', `${ecarts} écarts`);
  const eb = BA.beneficeArticle({ plateforme: 'eBay', vente: '45.00', recu: 40, entree: e1 });
  dit(eb.fraisSite === 500 && eb.recu === 4000 && eb.benefice === 1700, 'C3 eBay : frais eBay lus (45 − 40), puis versé − frais saisis − achat = 17 €', JSON.stringify(eb));
  const eb2 = BA.beneficeArticle({ plateforme: 'eBay', vente: '45.00', recu: null, raisonRecu: 'frais eBay inconnus', entree: e1 });
  dit(eb2.etat === 'plateforme' && eb2.benefice == null && eb2.manque.includes('plateforme') && eb2.raisonRecu === 'frais eBay inconnus', 'C3 eBay frais pas lus ⇒ « — », la raison nommée (jamais comptés à 0)', JSON.stringify(eb2));
  dit(BA.beneficeArticle({ plateforme: 'Leboncoin', vente: 30, entree: e1 }).fraisSite === 0, 'C4 Leboncoin : le prix capté est ce que le vendeur touche');
  const vc = BA.beneficeArticle({ plateforme: 'Vestiaire', vente: null, recu: 80, entree: e1 });
  dit(vc.fraisSite == null && vc.benefice === 5700 && vc.etat === 'ok', 'C5 Vestiaire : commission pas lue, le bénéfice part du versé (80 − 3 − 20)', JSON.stringify(vc));
  const sa = BA.beneficeArticle({ plateforme: 'Vinted', vente: '50', entree: { fees: '1', fraisComplets: true } });
  dit(sa.etat === 'achat' && sa.benefice == null && sa.manque.includes('achat'), 'C6 prix d’achat pas saisi ⇒ « — » (jamais un achat à 0 €)', JSON.stringify(sa));
  const S = BA.beneficeListe([v1, v2, sa, eb2, BA.beneficeArticle({ plateforme: 'Vinted', vente: '9', entree: e1, annulee: true })]);
  dit(S.n === 4 && S.nCompte === 2 && S.somme === 5400 && S.auPlus === true && S.manque.achat === 1 && S.manque.plateforme === 1 && S.manque.frais === 1, 'C7 la liste : somme des calculables « sur 2 de 4 », « au plus » (un frais à confirmer), les manques comptés, l’annulée hors liste', JSON.stringify(S));
  dit(!('auMoins' in S) && BA.beneficeListe([v1]).auPlus === false, 'C7 une liste ne dit jamais « au moins » (un prix d’achat inconnu peut être à perte)');
  dit(BA.beneficeListe([]).somme === null, 'C7 rien de calculable ⇒ « — », jamais 0');
  const lb = BA.lignesBeneficeArticle(eb, T);
  dit(lb.map((l) => l.cle).join() === 'vente,site,recu,saisis,achat,reste' && lb.find((l) => l.cle === 'reste').v === 1700, 'C8 la décomposition : vente, frais du site, versé, frais notés, achat, ce qui reste', lb.map((l) => l.cle).join());
  // La fiche : eBay retire aussi les frais SAISIS (la règle de Ventes et de la compta).
  try {
    const o = { montantRecuEbay: (c) => ({ eur: 40, raison: '' }), commandeEbayEngagee: () => true, etapeVente: () => ({ label: '', step: 4 }) };
    const rn = { cle: '12', etat: 'present', annonces: [{ id: 'A1', etat: 'vendue' }], bordereaux: [], manques: [],
      ventes: { vinted: [], lbc: [], ebay: [{ orderId: 'E1', creationDate: '2026-10-10T10:00:00Z', paymentSummary: { totalDueSeller: { value: '45.00', currency: 'EUR' } } }] } };
    const p = FP.parcoursPaire(rn, { fiches: { A1: { numero: 12, buyPrice: '20', fees: '3', fraisComplets: true } } }, o);
    dit(p && p.resume && p.resume.benefice === 1700 && p.resume.detail && p.resume.detail.fraisSite === 500, 'C9 la fiche (eBay) : 40 versés − 3 € de frais saisis − 20 € = 17 €, frais eBay 5 € nommés', JSON.stringify(p && p.resume));
  } catch (e) { dit(false, 'C9 la fiche (eBay) se calcule', e.message); }

  // ═══ D. LA SAUVEGARDE ═══
  dit(JSON.stringify(SV.LOURDS) === JSON.stringify(RG.LOURDS) && JSON.stringify(SV.SECRETS) === JSON.stringify(RG.SECRETS), 'D1 les lignes lourdes et secrètes sont celles de l’export RGPD du serveur (une règle)');
  dit(SV.natureLigne('email_bord_123') === 'lourde' && SV.natureLigne('ebay_tokens_x') === 'secret' && SV.natureLigne('main') === 'legere' && SV.estBordereau('harvest_9_label_123456') && !SV.estBordereau('harvest_9_label_latest'), 'D2 lourde / secrète / légère ; `label_latest` n’est pas un bordereau');
  dit(SV.categorieDe('harvest_9_orders_sold') === 'ventes' && SV.categorieDe('harvest_9_listings') === 'annonces' && SV.categorieDe('email_bord_1') === 'colis' && SV.categorieDe('main') === 'reglages' && SV.categorieDe('zz') === 'autres', 'D2 les catégories du JSON');
  const B64PDF = Buffer.from('%PDF-1.4 inventé').toString('base64');
  const base = {
    main: { vinted_regime: 'micro', jeton: { refresh_token: 'NE-DOIT-PAS-SORTIR' } },
    harvest_9_listings: { capturedAt: '2026-11-10T10:00:00Z', payload: { items: [{ id: 77, title: 'Annonce inventée', price: { amount: '42.0' }, brand_title: 'Marque', size_title: '42', status: 'Très bon état', favourite_count: 3, promoted: false }] } },
    harvest_9_orders_sold: { payload: { my_orders: [{ transaction_id: 1 }] } },
    ebay_tokens_9: { access_token: 'SECRET' },
    email_bord_555: { pdfB64: B64PDF },
    email_bord_556: { pdfB64: Buffer.from('<html>').toString('base64') },
    harvest_9_label_123456: { pdfB64: B64PDF },
    harvest_9_label_latest: { pdfB64: B64PDF },
  };
  const requetes = [];
  const fauxLireTout = (rate = null) => async (q) => {
    requetes.push(q);
    if (rate && rate.test(q)) return null;
    const p = new URLSearchParams(q);
    if (!/owner=eq\.u1/.test(q)) return [];
    const ids = Object.keys(base);
    const sel = p.get('select') || '';
    let l = ids;
    const inn = /^in\.\((.*)\)$/.exec(p.get('id') || ''); const like = /^like\.(.*)$/.exec(p.get('id') || '');
    if (inn) { const v = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); l = ids.filter((i) => v.includes(i)); }
    if (like) { const re = new RegExp('^' + like[1].split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); l = ids.filter((i) => re.test(i)); }
    return l.map((id) => ({ id, updated_at: '2026-11-01', ...(sel.includes('data') ? { data: base[id] } : {}), ...(sel.includes('meta') ? { meta: { id } } : {}) }));
  };
  const lirePdf = SV.lecteurPdfBordereau({ fetcher: async (u) => { requetes.push(u); const id = decodeURIComponent(/id=eq\.([^&]+)/.exec(u)[1]); if (id === 'harvest_9_label_123456' && /panne/.test(process.env.AUDIT_PANNE || '')) return { ok: false }; return { ok: true, json: async () => [{ b: (base[id] || {}).pdfB64 || null }] }; }, url: 'https://base.invalid', auth: () => ({}), owner: 'u1' });
  const lu = await SV.lireSauvegarde({ lireTout: fauxLireTout(), lirePdf, owner: 'u1' });
  const qData = requetes.filter((q) => /select=[^&]*\bdata\b/.test(decodeURIComponent(q)) && !/pdfB64/.test(q));
  dit(requetes.every((q) => /owner=eq\.u1/.test(q)), 'D3 chaque lecture porte `owner=eq.<lui>` (en plus de RLS)', requetes.filter((q) => !/owner=eq\.u1/.test(q)).join(' | '));
  dit(qData.every((q) => !/email_bord|_label_|_txn_/.test(decodeURIComponent(q))) && lu.lourdes.length >= 4, 'D3 jamais `select=data` sur une ligne lourde : leur résumé (`meta`) seulement', qData.join(' | '));
  dit(lu.pdfs.length === 2 && lu.pdfAbsents === 1 && lu.legeres.every((r) => SV.natureLigne(r.id) === 'legere') && !lu.legeres.some((r) => /ebay_tokens/.test(r.id)), 'D3 deux PDF lus (`%PDF` vérifié, `label_latest` exclu), une page HTML comptée « absente », aucun secret lu', JSON.stringify({ p: lu.pdfs.map((x) => x.id), a: lu.pdfAbsents }));
  const src = { releve: [['Vinted', 'vendeuse', '1', Date.parse('2026-10-01'), 50, 20, 3, 'Titre inventé', '12', null]], achats: [], fiches: { 77: { numero: 12 } } };
  const z = SV.zipSauvegarde({ lu, sources: src, quand: new Date('2026-11-15T10:00:00Z'), nomCompte: (u) => (u === '9' ? 'vendeuse' : u) });
  const f = ED.lireZipStocke(z.octets);
  const tetes = [...new Set(f.map((x) => x.nom.split('/')[0]))];
  const tout = f.map((x) => x.texte).join('\n');
  dit(tetes.length === 1 && tetes[0] === 'VRM-sauvegarde-2026-11-15' && f.every((x) => x.crcOk), 'D5 le zip se dézippe en UN dossier, chaque fichier relu (CRC)', tetes.join());
  dit(f.some((x) => /donnees\/ventes\.json$/.test(x.nom)) && f.some((x) => /donnees\/reglages\.json$/.test(x.nom)) && f.filter((x) => /donnees\/.*\.json$/.test(x.nom)).every((x) => { try { JSON.parse(x.texte); return true; } catch (_) { return false; } }), 'D5 un JSON lisible par catégorie');
  const ann = ED.lireCsv((f.find((x) => /tableaux\/annonces\.csv$/.test(x.nom)) || {}).texte || '');
  dit(ann[1] && ann[1][0] === 'vendeuse' && ann[1][2] === '12' && ann[1][4] === '42,00' && f.some((x) => /tableaux\/ventes\.csv$/.test(x.nom) && /Titre inventé/.test(x.texte)) && f.some((x) => /tableaux\/achats\.csv$/.test(x.nom)), 'D5 les tableaux ventes, achats et annonces (N° par identité, prix « 42,00 »)', JSON.stringify(ann));
  dit(f.filter((x) => /bordereaux\/.*\.pdf$/.test(x.nom)).length === 2 && f.filter((x) => /\.pdf$/.test(x.nom)).every((x) => x.octets[0] === 0x25), 'D5 les PDF de bordereaux encore présents');
  dit(!/NE-DOIT-PAS-SORTIR|SECRET|ebay_tokens/.test(tout) && z.etat.complet, 'D5 aucun jeton ni ligne secrète dans le zip ; lecture complète ⇒ « complet »');
  requetes.length = 0;
  const luR = await SV.lireSauvegarde({ lireTout: fauxLireTout(/id=in\./), lirePdf, owner: 'u1' });
  const zR = SV.zipSauvegarde({ lu: luR, sources: null, quand: new Date('2026-11-15T10:00:00Z') });
  const lis = (ED.lireZipStocke(zR.octets).find((x) => /LISEZMOI/.test(x.nom)) || {}).texte || '';
  dit(!zR.etat.complet && zR.etat.manques.length > 0 && /INCOMPLET/.test(lis), 'D4 une page ratée ⇒ « incomplet », NOMMÉ dans LISEZMOI (jamais un zip présenté complet)', JSON.stringify(zR.etat));
  dit((await SV.lecteurPdfBordereau({ fetcher: async () => ({ ok: false }), url: 'x', auth: () => ({}) })('email_bord_1')) === null, 'D6 base qui ne répond pas ⇒ `null` (« pas su »), jamais « absent »');

  // ═══ E. LE TEXTE ═══
  const fichiers = ['src/bilanFinMois.js', 'src/BilanFinMois.jsx', 'src/alertesSeuils.js', 'src/AlertesSeuils.jsx', 'src/beneficeArticle.js', 'src/BeneficeArticle.jsx', 'src/sauvegardeDonnees.js', 'src/SauvegardeDonnees.jsx', 'api/_lib/argent-notif.js', 'api/_lib/argent-passes.js'];
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  dit(fichiers.every((x) => !/encaiss/i.test(sansCommentaires(lire(x)))), 'E1 jamais « encaissé » (hors commentaires)');
  const cles = new Set(); for (const x of fichiers) for (const m of lire(x).matchAll(/tr\(\s*'(argentPlus\.[\w.]+)'/g)) cles.add(m[1]);
  for (const m of lire('src/ecrans/Compta.jsx').matchAll(/tr\(\s*'(argentPlus\.[\w.]+)'/g)) cles.add(m[1]);
  for (const m of lire('src/bilanFinMois.js').matchAll(/T\(\s*'(argentPlus\.[\w.]+)'/g)) cles.add(m[1]);
  for (const m of lire('src/beneficeArticle.js').matchAll(/T\(\s*'(argentPlus\.[\w.]+)'/g)) cles.add(m[1]);
  const manquent = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = lire(`src/i18n/langues/${l}/argentPlus.js`); for (const k of cles) if (!t.includes(JSON.stringify(k))) manquent.push(`${l}:${k}`); }
  dit(cles.size >= 30 && manquent.length === 0, `E2 chaque clé argentPlus.* (${cles.size}) existe dans les 5 langues`, manquent.slice(0, 6).join(' '));
  fs.rmSync(dir, { recursive: true, force: true });
}

(async () => {
  const mut = process.argv.includes('--mutation');
  if (!mut) {
    await verifier(null);
    console.log(`\n${ko ? '❌' : '✅'} ${ok} vérifiés · ${ko} en défaut`);
    process.exit(ko ? 1 : 0);
  }
  SILENCE = true;
  const res = [];
  for (const [nom, m] of Object.entries(MUTATIONS)) {
    ok = 0; ko = 0; journal.length = 0;
    try { await verifier(m); } catch (e) { ko++; journal.push('exception : ' + e.message); }
    res.push([nom, ko, journal.slice(0, 2)]);
    console.log(`${ko ? '✅ rouge' : '❌ VERT'} ${nom} : ${ko} rouge${ko > 1 ? 's' : ''}${ko ? ' — ' + journal.slice(0, 2).join(' | ') : ''}`);
  }
  const vertes = res.filter((r) => !r[1]);
  console.log(`\n${vertes.length ? '❌' : '✅'} ${res.length - vertes.length}/${res.length} mutations rougissent`);
  process.exit(vertes.length ? 1 : 0);
})();
