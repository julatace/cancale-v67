// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « MOIS BOUCLÉ » (lot BK) ET « COMPARER DEUX MOIS » À DEUX SÉLECTEURS (lot BL)
//         node scripts/audit-mois-boucle.cjs [--mutation=NOM] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// L'audit EXÉCUTE src/moisBoucle.js et src/comparerMois.js avec les VRAIES règles
// d'App.jsx (`montantPeriodeUrssaf`, `moisDeclare`, `beneficeDesJours`…), le vrai
// registre des achats (src/registres.js) et la vraie lecture du reçu publié
// (`recuPublieEntre`), sur des données INVENTÉES, et compare à un calcul fait ici.
// Ce qu'il exige (§5) :
//   · « prêt » SEULEMENT si tout est lu à zéro ET le montant du mois complet —
//     jamais sur un « pas su » (fraîcheur pas publiée, extension pas vérifiée,
//     publication absente, mois pas couvert), jamais avec un compte pas relu ;
//   · le montant « à déclarer » = `montantPeriodeUrssaf` du mois (daté au VERSEMENT) ;
//   · rien n'est décidé sur les ventes à dater (comptées, nommées, c'est tout) ;
//   · Comparer : deux mois QUELCONQUES, le mois en cours coupe l'autre au même
//     quantième ; reçu = jour du VERSEMENT (jamais celui de la vente) ; une
//     flèche (neutre) seulement entre deux chiffres sus ET complets ; les achats
//     du registre, « au moins » quand les achats Vinted ne sont pas lus.
// `--prouve` rejoue l'audit sous chaque mutation : chacune doit le faire rougir.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  // « prêt » alors qu'un compte n'est pas relu : la fraîcheur ne nomme plus personne.
  'compte-pas-lu': ['boucle', "if (!r || !(r.source === 'compte' || r.source === 'panne')) continue;", 'continue;'],
  // « pas su » pris pour « oui » : la fraîcheur pas encore publiée vaut « tout relu ».
  'fraicheur-encours': ['boucle', "if (f === undefined || (f && f.etat === 'encours')) return { etat: 'encours', n: null, noms: [] };", "if (f === undefined || (f && f.etat === 'encours')) return { etat: 'lu', n: 0, noms: [] };"],
  // Une ligne pas sue n'empêche plus « prêt ».
  'passu-ignore': ['boucle', "else if (lignes.some((l) => l.etat === 'passu')) etat = 'passu';", ''],
  // « prêt » sur un montant qui n'est qu'un minimum.
  'montant-partiel': ['boucle', 'else if (montant.partiel && !(ad && ad.n > 0)) {', 'else if (false) {'],
  // Les ventes à dater ne comptent plus.
  'adater-tu': ['boucle', "lignes.push(ligneDe('adater', ligne.aDater && Number(ligne.aDater.n) > 0 ? Number(ligne.aDater.n) : 0));", "lignes.push(ligneDe('adater', 0));"],
  // Un mois pas fini passe pour bouclé.
  'mois-en-cours': ['boucle', "if (!fini) lignes.push({ cle: 'fini', etat: 'manque', n: null, raison: '', jusqua: due.periodEnd.getTime() });\n  else if", 'if'],
  // Les frais inconnus ne comptent plus.
  'frais-tus': ['boucle', "else lignes.push(ligneDe('frais', Number(B.fraisInconnus) || 0));", "else lignes.push(ligneDe('frais', 0));"],
  // Comparer : une flèche sur un « au moins ».
  'fleche-partiel': ['comparer', 'const complets = a.valeur != null && b.valeur != null && !a.partiel && !b.partiel;', 'const complets = a.valeur != null && b.valeur != null;'],
  // Comparer : le mois choisi d'en face n'est plus coupé au même point.
  'pas-meme-point': ['comparer', "const cote = (ym, b, enCours) => (enCours ? { de: b.de, a: maintenant, complet: false } : couper(ym, b));", "const cote = (ym, b, enCours) => (enCours ? { de: b.de, a: maintenant, complet: false } : { ...b, complet: true });"],
  // Comparer : achats Vinted pas lus ⇒ un nombre présenté complet.
  'achats-complets': ['comparer', 'const partiel = manque.length > 0;\n  return partiel && !(n > 0)', 'const partiel = false;\n  return partiel && !(n > 0)'],
  // Comparer : le reçu daté à la VENTE (le branchement de Statistiques lit le vendu).
  'recu-a-la-vente': ['stats', 'recuDe: (b) => recuAvecADater(recuPublieEntre(ligneUrssaf, b, maintenant), ligneUrssaf),', 'recuDe: (b) => ({ valeur: vendu ? bilanLignes(vendu.lignes, b.de, b.a - 1).eur : null }),'],
  // Mois bouclé n'est plus monté dans Déclarer.
  'pas-monte': ['compta', '<MoisBoucle portes={portesMoisBoucle({ onNav, ouvrirRepli: ouvrirRepliCompta })} />', ''],
  // La fraîcheur n'est plus publiée par son propriétaire.
  'pas-publiee': ['ligne', 'React.useEffect(() => { publierFraicheur(fRef.current); }, [signature]);', ''],
};

if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', env: process.env });
    const rouge = r.status === 1;
    if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} : ${rouge ? 'rouge' : 'PAS rouge (statut ' + r.status + ')'}`);
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${rouges === n ? '✅' : '❌'} audit-mois-boucle --prouve : ${rouges}/${n} mutations rougissent`);
  process.exit(rouges === n ? 0 : 1);
}

let APP = require('./_source-app.cjs').sourceApp(R);
const SRC = {
  boucle: lire('src/moisBoucle.js'), comparer: lire('src/comparerMois.js'), stats: lire('src/ecrans/Stats.jsx'),
  compta: lire('src/ecrans/Compta.jsx'), ligne: lire('src/LigneFraicheur.jsx'), jsx: lire('src/MoisBoucle.jsx'),
};
if (MUT) {
  const m = MUTATIONS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  if (!SRC[m[0]].includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  SRC[m[0]] = SRC[m[0]].replace(m[1], m[2]);
}

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
// Les imports relatifs se résolvent depuis le dossier du fichier (`dossier`, relatif à la racine).
const charger = async (texte, nom, dossier = 'src') => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte.replace(/from '(\.\.?\/[^']+)'/g, (m, f) => `from 'file://${path.join(R, dossier, f)}'`));
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const proche = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

(async () => {
  console.log('── Les modules, les règles d’App.jsx');
  let B = null; try { B = await charger(SRC.boucle, 'boucle'); if (typeof B.moisBoucle !== 'function') B = null; } catch (_) { B = null; }
  dit(!!B, 'src/moisBoucle.js exporte `moisBoucle`');
  let CM = null; try { CM = await charger(SRC.comparer, 'comparer'); if (typeof CM.comparerDeuxMois !== 'function') CM = null; } catch (_) { CM = null; }
  dit(!!CM, 'src/comparerMois.js exporte `comparerDeuxMois` (deux mois choisis)');
  let K = null; try { K = await charger(lire('src/design/carteChiffres.js'), 'carte', 'src/design'); } catch (_) { K = null; }
  let REG = null; try { REG = await charger(lire('src/registres.js'), 'registres'); } catch (_) { REG = null; }
  dit(!!(REG && typeof REG.registreDesAchats === 'function'), 'le registre des achats se charge (src/registres.js)');
  dit(!!(K && typeof K.recuPublieEntre === 'function'), 'la lecture du reçu publié se charge (`recuPublieEntre`)');
  const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours',
    'moisPeriodeUrssaf', 'minuitParisMs', 'aPayerUrssaf', 'montantPeriodeUrssaf', 'moisDeclare', 'bilanLignes'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, Intl, tauxUrssaf: () => 12.4, console };
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les règles se lisent dans App.jsx', absents.join(', '));
  const N = await charger(lire('src/beneficeNoms.js'), 'noms');

  if (B && !absents.length) {
    console.log('── Mois bouclé : octobre 2026, regardé le 10 novembre');
    const MAINT = new Date(2026, 10, 10, 15).getTime();
    const T = (y, m, j, h = 12) => new Date(y, m, j, h).getTime();
    const RG = { montantPeriodeUrssaf: ctx.montantPeriodeUrssaf, moisDeclare: ctx.moisDeclare, beneficeDesJours: ctx.beneficeDesJours, moisCouvert: N.moisCouvertParPublication };
    // La ligne publiée par Ventes (`vinted_urssaf_mois`) : octobre versé 410 €, publiée le 9 novembre.
    const ligneOk = { mois: [{ ym: '2026-10', ca: 410, n: 5 }, { ym: '2026-11', ca: 90, n: 1 }], at: T(2026, 10, 9), aDater: { n: 0 }, sources: { vinted: 'lu' } };
    // Le bénéfice publié (`vrm_benefice_jours`) : trois ventes d'octobre, prix d'achat connus, frais connus.
    const jours = {};
    const vend = (t, eur, achat, frais, plat) => { const k = ctx.jourClef(new Date(t)); const a = ctx.beneficeVide(); if (jours[k]) ctx.cumulerBenefice(a, jours[k]); ctx.ajouterVenteBenefice(a, eur, achat, frais, plat); jours[k] = ctx.jourBeneficeEnTableau(a); };
    vend(T(2026, 9, 3), 120, 60, 0); vend(T(2026, 9, 12), 150, 70, 0); vend(T(2026, 9, 25), 140, 50, 0);
    const pubOk = { v: 2, jours: { ...jours } };
    const aJour = { etat: 'a-jour', retards: [], passu: [] };
    const base = { ym: '2026-10', maintenant: MAINT, ligne: ligneOk, declare: {}, joursBenef: pubOk, fraicheur: aJour, taux: 12.4, R: RG };
    const M0 = B.moisBoucle(base);
    const L = (M, cle) => M.lignes.find((l) => l.cle === cle) || {};
    dit(M0.etat === 'pret', 'tout lu, tout réglé, montant complet ⇒ « prêt »', JSON.stringify(M0.lignes.map((l) => l.cle + ':' + l.etat)));
    const attendu = ctx.montantPeriodeUrssaf(B.dueDuMois('2026-10'), ligneOk, 12.4);
    dit(M0.montant && proche(M0.montant.ca, 410) && proche(M0.montant.ca, attendu.ca) && !attendu.partiel, 'le montant à déclarer = `montantPeriodeUrssaf` du mois (410 €, daté au versement)', JSON.stringify(M0.montant));
    dit(M0.nom === 'Octobre', '« Octobre est prêt à déclarer »');

    console.log('── Jamais « prêt » avec un compte pas relu, ni sur un « pas su »');
    const fRetard = { etat: 'retard', retards: [{ cle: 'compte:vinted:111', source: 'compte', plateforme: 'vinted', id: '111', nom: 'atelier' }, { cle: 'achats:vinted:222', source: 'compte', plateforme: 'vinted', id: '222', nom: 'autre' }], passu: [] };
    const M1 = B.moisBoucle({ ...base, fraicheur: fRetard });
    dit(M1.etat === 'manque' && L(M1, 'comptes').n === 1 && L(M1, 'comptes').noms[0] === 'atelier', 'un compte pas relu ⇒ « 1 compte à relire », pas prêt (ses ACHATS en retard ne comptent pas)', JSON.stringify(L(M1, 'comptes')));
    const fPanne = { etat: 'retard', retards: [{ cle: 'panne:vinted:111', source: 'panne', plateforme: 'vinted', id: '111', nom: 'atelier' }], passu: [] };
    dit(B.moisBoucle({ ...base, fraicheur: fPanne }).etat === 'manque', 'un compte qui n’arrive plus ⇒ pas prêt');
    for (const [nom, f] of [['pas encore publiée', undefined], ['en cours', { etat: 'encours', retards: [], passu: [] }]]) {
      const M = B.moisBoucle({ ...base, fraicheur: f });
      dit(M.etat === 'encours' && L(M, 'comptes').etat === 'encours', `fraîcheur ${nom} ⇒ « Vérification… », jamais prêt`, M.etat);
    }
    for (const [nom, f] of [['base injoignable', { etat: 'cache', raison: 'base', retards: [], passu: [] }], ['extension pas vérifiée', { etat: 'passu', retards: [], passu: ['l’extension'] }], ['rien de relié', { etat: 'cache', raison: 'rien', retards: [], passu: [] }]]) {
      const M = B.moisBoucle({ ...base, fraicheur: f });
      dit(M.etat === 'passu' && L(M, 'comptes').etat === 'passu', `fraîcheur « ${nom} » ⇒ pas su, jamais prêt`, M.etat);
    }
    const M2 = B.moisBoucle({ ...base, ligne: null });
    dit(M2.etat === 'passu' && L(M2, 'adater').etat === 'passu' && M2.montant == null, 'CA pas publié ⇒ « — », pas prêt, aucun montant');
    dit(B.moisBoucle({ ...base, ligne: undefined }).etat === 'encours', 'CA en lecture ⇒ en cours');
    const M3 = B.moisBoucle({ ...base, joursBenef: null });
    dit(M3.etat === 'passu' && L(M3, 'prix').etat === 'passu' && L(M3, 'frais').etat === 'passu', 'bénéfice pas publié ⇒ prix et frais « — », pas prêt');
    const M3b = B.moisBoucle({ ...base, ym: '2024-10' });
    dit(M3b.etat !== 'pret' && L(M3b, 'prix').raison === 'mois pas couvert', 'un mois que la publication ne couvre pas ⇒ pas su');
    dit(B.moisBoucle({ ...base, declare: undefined }).etat === 'encours', 'registre « déclaré » pas lu ⇒ en cours');

    console.log('── Ce qui manque : compté, nommé, avec sa porte');
    const M4 = B.moisBoucle({ ...base, ligne: { ...ligneOk, aDater: { n: 3, de: T(2026, 8, 1), a: T(2026, 9, 20) } } });
    dit(M4.etat === 'manque' && L(M4, 'adater').n === 3 && !L(M4, 'montant').cle, '3 ventes à dater ⇒ « 3 », pas prêt ; le minimum qu’elles font est déjà dit par elles', JSON.stringify(L(M4, 'adater')));
    dit(!/aDater\s*[:=]\s*\{/.test(sansCommentaires(SRC.boucle).replace(/ligne\.aDater/g, '')), 'rien n’est décidé sur les ventes à dater (aucune écriture)');
    vend(T(2026, 9, 28), 90, null, 0);   // une vente sans prix d'achat
    vend(T(2026, 9, 29), 80, 30, null, 'eBay');   // une vente eBay aux frais inconnus
    const M5 = B.moisBoucle({ ...base, joursBenef: { v: 2, jours } });
    const R5 = ctx.beneficeDesJours(jours, new Date(2026, 9, 1), new Date(2026, 10, 1));
    dit(L(M5, 'prix').n === 1 && L(M5, 'prix').n === R5.n - R5.nCout && L(M5, 'prix').sur === 5, 'prix d’achat : 1 sur 5 ventes du mois (n − nCout de `beneficeDesJours`)', JSON.stringify(L(M5, 'prix')));
    dit(L(M5, 'frais').n === 1 && R5.fraisInconnus === 1, 'frais inconnus : 1 (`fraisInconnus` de la publication)', JSON.stringify(L(M5, 'frais')));
    dit(M5.etat === 'manque' && M5.aRegler === 2, '2 choses à régler', String(M5.aRegler));
    const M6 = B.moisBoucle({ ...base, ligne: { ...ligneOk, at: T(2026, 9, 30) } });
    dit(M6.etat === 'manque' && L(M6, 'montant').etat === 'manque' && L(M6, 'montant').raison === 'avantFin', 'CA calculé AVANT la fin du mois ⇒ « montant incomplet », pas prêt', JSON.stringify(L(M6, 'montant')));
    const M7 = B.moisBoucle({ ...base, ligne: { ...ligneOk, nonComptees: { n: 2 } } });
    dit(M7.etat === 'manque' && L(M7, 'montant').n === 2, 'des ventes au montant pas lu ⇒ nommées, pas prêt');
    const M8 = B.moisBoucle({ ...base, ym: '2026-11' });
    dit(M8.etat === 'manque' && L(M8, 'fini').etat === 'manque', 'novembre, pas fini ⇒ « Mois en cours », jamais prêt', JSON.stringify(M8.lignes.map((l) => l.cle + ':' + l.etat)));
    const M9 = B.moisBoucle({ ...base, declare: { '2026-10': { ids: ['x'] } } });
    dit(M9.etat === 'declare', 'un mois noté « déclaré » (registre, SON clic) ⇒ « noté déclaré »');
    dit(B.moisParDefaut(MAINT) === '2026-10' && B.moisChoisissables(MAINT)[0] === '2026-11' && B.moisChoisissables(MAINT).length === 13, 'le mois proposé : le dernier fini ; au choix : celui-ci et les 12 d’avant');
  }

  if (CM && K && REG && !absents.length) {
    console.log('── Comparer deux mois choisis');
    const MAINT = new Date(2026, 10, 10, 15).getTime();
    const T = (y, m, j, h = 12) => new Date(y, m, j, h).getTime();
    // Une vente VENDUE en septembre et VERSÉE en octobre : vendu ≠ reçu.
    const lignes = [
      { plateforme: 'Vinted', ts: T(2026, 8, 28), eur: 100 }, { plateforme: 'Vinted', ts: T(2026, 8, 5), eur: 40 },
      { plateforme: 'Vinted', ts: T(2026, 10, 2), eur: 60 }, { plateforme: 'Vinted', ts: T(2026, 10, 9), eur: 30 }, { plateforme: 'Vinted', ts: T(2026, 10, 10, 9), eur: 25 },
      { plateforme: 'Vinted', ts: T(2025, 10, 3), eur: 70 }, { plateforme: 'Vinted', ts: T(2025, 10, 20), eur: 55 },
    ];
    const vendu = { lignes, manque: [], nonComptees: [] };
    const ligneU = { mois: [], recu: { '2026-09': 40, '2026-10': 100, '2026-11': 60, '2025-11': 70 }, recuJours: { '2026-09-07': 40, '2026-10-02': 100, '2026-11-04': 60, '2025-11-05': 70 }, sources: { vinted: 'lu' }, at: MAINT - 3600e3 };
    const recuDe = (b) => K.recuPublieEntre(ligneU, b, MAINT);
    const achatsV = [{ transaction_id: 1, date: new Date(T(2026, 8, 3)).toISOString(), status: 'Commande finalisée', price: { amount: '30', currency_code: 'EUR' } },
      { transaction_id: 2, date: new Date(T(2026, 8, 20)).toISOString(), status: 'Commande annulée', price: { amount: '30', currency_code: 'EUR' } },
      { transaction_id: 3, date: new Date(T(2026, 10, 4)).toISOString(), status: 'Commande finalisée', price: { amount: '45', currency_code: 'EUR' } },
      { transaction_id: 4, date: new Date(T(2026, 10, 9)).toISOString(), status: 'Commande finalisée', price: { amount: '45', currency_code: 'EUR' } }];
    const achatsDe = (achats) => ({ ym }) => REG.registreDesAchats({ achats, hors: [], fiches: {}, periode: ym });
    const RGc = { bilanLignes: ctx.bilanLignes };
    const C1 = CM.comparerDeuxMois({ ymA: '2026-09', ymB: '2026-10', maintenant: MAINT, vendu, recuDe, beneficeDe: () => null, achatsDe: achatsDe(achatsV), R: RGc });
    const Lc = (C, k) => C.lignes.find((x) => x.cle === k);
    dit(C1 && C1.lignes.map((x) => x.cle).join(',') === 'vendu,recu,benefice,ventes,achats', 'cinq lignes : vendu, reçu, bénéfice, ventes, achats', C1 && C1.lignes.map((x) => x.cle).join(','));
    dit(C1.memePoint === false && proche(Lc(C1, 'vendu').a.valeur, 140) && proche(Lc(C1, 'vendu').b.valeur, 0), 'septembre et octobre entiers : vendu 140 € face à 0 € (date de la VENTE)');
    dit(proche(Lc(C1, 'recu').a.valeur, 40) && proche(Lc(C1, 'recu').b.valeur, 100), 'reçu 40 € face à 100 € : la vente du 28 sept. est REÇUE en octobre (jour du versement)', `${Lc(C1, 'recu').a.valeur} / ${Lc(C1, 'recu').b.valeur}`);
    dit(Lc(C1, 'achats').a.valeur === 1 && Lc(C1, 'achats').b.valeur === 0, 'achats : 1 en septembre (l’annulé n’y est pas), 0 en octobre — le registre des achats', JSON.stringify(Lc(C1, 'achats').a));
    dit(Lc(C1, 'vendu').sens === 'hausse' && proche(Lc(C1, 'vendu').ecart, 140) && Lc(C1, 'recu').sens === 'baisse' && Lc(C1, 'benefice').sens == null, 'écart du 1er mois face au 2d (+140 € vendu, −60 € reçu), flèche neutre ; aucune sur un « — »');
    console.log('── Un mois en cours choisi EN FACE : il coupe l’autre au même point');
    const C2 = CM.comparerDeuxMois({ ymA: '2025-11', ymB: '2026-11', maintenant: MAINT, vendu, recuDe, beneficeDe: () => null, achatsDe: achatsDe(achatsV), R: RGc });
    dit(C2.memePoint === true && Lc(C2, 'ventes').a.valeur === 1 && Lc(C2, 'ventes').b.valeur === 3, 'nov. 2025 coupé au 10 à 15 h : 1 vente (pas celle du 20) ; nov. 2026 : 3', `${Lc(C2, 'ventes').a.valeur} / ${Lc(C2, 'ventes').b.valeur}`);
    dit(Lc(C2, 'achats').b.valeur === 2 && Lc(C2, 'achats').a.valeur === 0, 'achats de novembre 2026 au même point : 2');
    console.log('── Trois états, aucune flèche fausse');
    const C3 = CM.comparerDeuxMois({ ymA: '2026-09', ymB: '2025-11', maintenant: MAINT, vendu: { ...vendu, manque: ['eBay'] }, recuDe, beneficeDe: () => null, achatsDe: achatsDe(null), R: RGc });
    dit(Lc(C3, 'vendu').a.partiel && Lc(C3, 'vendu').b.partiel && Lc(C3, 'vendu').a.valeur > 0 && Lc(C3, 'vendu').sens == null && Lc(C3, 'vendu').ecart == null, 'eBay pas lu ⇒ « au moins » des deux côtés, aucune flèche');
    dit(Lc(C3, 'achats').a.raison === 'partiel' && Lc(C3, 'achats').a.valeur == null && Lc(C3, 'achats').b.valeur == null && Lc(C3, 'achats').sens == null, 'achats Vinted pas lus ⇒ jamais « au moins 0 », « — », aucune flèche', JSON.stringify(Lc(C3, 'achats').a));
    const C4 = CM.comparerDeuxMois({ ymA: '2026-09', ymB: '2026-10', maintenant: MAINT, vendu, recuDe, beneficeDe: () => null, achatsDe: () => undefined, R: RGc });
    dit(Lc(C4, 'achats').a.valeur == null && Lc(C4, 'achats').a.raison === 'encours', 'achats en lecture ⇒ en cours (« — »), jamais 0');
    dit(CM.comparerDeuxMois({ ymA: '2026-12', ymB: '2026-10', maintenant: MAINT, vendu, R: RGc }) === null, 'un mois à venir ne se compare pas');
    const C5 = CM.comparerMois({ ymA: '2026-11', mode: 'an', maintenant: MAINT, vendu, recuDe, beneficeDe: () => null, R: RGc });
    dit(C5 && C5.ymB === '2025-11' && C5.mode === 'an', '`comparerMois` (mois d’avant / il y a un an) reste le même chemin');
  }

  console.log('── Le branchement');
  const S0 = sansCommentaires(SRC.stats), C0 = sansCommentaires(SRC.compta), L0 = sansCommentaires(SRC.ligne), J0 = sansCommentaires(SRC.jsx);
  dit(/recuDe: \(b\) => recuAvecADater\(recuPublieEntre\(ligneUrssaf, b, maintenant\), ligneUrssaf\)/.test(S0), 'Comparer : le reçu = la ligne publiée datée au VERSEMENT (`recuPublieEntre`)');
  dit(/comparerDeuxMois\(\{ ymA: choix\.a, ymB: choix\.b/.test(S0) && /data-comparer-mois=\{k\}/.test(S0), 'Comparer : deux sélecteurs, deux mois choisis');
  dit(/m\.registreAchatsDe/.test(S0) && /registreAchatsDe = \(/.test(C0), 'Comparer : les achats = le registre des achats de Comptabilité');
  dit(!/#(?:FF3B30|34C759|30D158|FF453A)|C\.(?:danger|ok|vert|rouge)/i.test((/function ComparerMoisCarte[\s\S]*?\n}\n/.exec(S0) || [''])[0]), 'Comparer : aucune couleur rouge ni verte');
  const decl = (/data-argent-vue="declarer"[\s\S]*?data-argent-vue="factures"/.exec(C0) || [''])[0];
  dit(/<MoisBoucle portes=\{portesMoisBoucle\(/.test(decl), 'Mois bouclé est monté dans Argent → Déclarer');
  dit(/publierFraicheur\(fRef\.current\)/.test(L0) && /suivreFraicheur\(setF\)/.test(J0), 'les comptes pas relus viennent de la ligne de fraîcheur PUBLIÉE (aucun second calcul)');
  dit(/montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert: moisCouvertParPublication/.test(J0), 'Mois bouclé passe les règles propriétaires d’App.jsx');
  dit(!/encaiss/i.test(SRC.jsx + SRC.boucle), 'jamais « encaissé »');

  console.log(`\n${ko ? '❌' : '✅'} audit-mois-boucle : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
