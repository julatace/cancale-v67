// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « CLÔTURER L'ANNÉE » (11 nov.)
//         node scripts/audit-cloture-annee.cjs [--mutation=NOM] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// L'audit EXÉCUTE src/clotureAnnee.js avec les VRAIES règles : celles d'App.jsx
// (`montantPeriodeUrssaf`, `moisDeclare`, `beneficeDesJours`, lues dans le source
// et jouées en vm), et les vrais modules `caAnnee`, `declarationRevenus`,
// `jaugeSeuils` (src/microEntreprise.js), `dac7ParPlateforme` (src/seuilsAnnee.js),
// sur des données INVENTÉES. Chaque chiffre de la liste doit ÊTRE celui de la règle
// du propriétaire (jamais un second calcul). Il exige (§5) :
//   · « pas su » ≠ « ✓ » ; jamais « prêt » sur un pas su, une lecture en cours,
//     une étape à faire ; l'export n'est jamais « ✓ » (VRM ne sait pas s'il est parti) ;
//   · le CA de l'année = `caAnnee`, daté au VERSEMENT ; « au moins » dit ;
//   · la case des impôts suit SA réponse au versement libératoire, jamais devinée ;
//   · l'inventaire n'est « ✓ » que lu LE 31 décembre ;
//   · aucune écriture, sauf « J'ai fini » (son clic) ;
//   · visible de décembre à mai ; carte de Ma journée en décembre/janvier, une fois.
// `--prouve` rejoue l'audit sous chaque mutation : chacune doit le faire rougir.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

const MUTATIONS = {
  // Les ventes à dater vendues APRÈS l'année comptent quand même.
  'adater-toutes': ['cl', 'n = Math.max(0, total - apres);', 'n = total;'],
  // Les ventes à dater ne comptent plus du tout.
  'adater-tues': ['cl', "return { cle: 'adater', etat: n > 0 ? 'manque' : 'ok', n,", "return { cle: 'adater', etat: 'ok', n,"],
  // Un « pas su » n'empêche plus « prêt ».
  'passu-ignore': ['cl', ": passuN ? 'passu' : 'pret';", ": 'pret';"],
  // L'export passe pour fait.
  'export-coche': ['cl', "const etapeExport = (annee) => ({ cle: 'export', etat: 'geste',", "const etapeExport = (annee) => ({ cle: 'export', etat: 'ok',"],
  // L'inventaire lu n'importe quel jour vaut « ✓ ».
  'inventaire-jour': ['cl', "if (lue !== dernier) return passu('inventaire', 'pas-ce-jour',", "if (false) return passu('inventaire', 'pas-ce-jour',"],
  // La case devinée sans sa réponse au versement libératoire.
  'case-devinee': ['cl', "if (dr.liberatoire == null) return { cle: 'revenus', etat: 'manque'", "if (false) return { cle: 'revenus', etat: 'manque'"],
  // Le reste URSSAF compte les périodes déjà déclarées.
  'reste-declare': ['cl', 'const restent = P.filter((p) => !p.faite);', 'const restent = P;'],
  // Un mois pas encore lu présenté « 0 € ».
  'mois-zero': ['cl', "mois.push({ ym, ca: l ? r2(Number(l.ca) || 0) : (lu ? 0 : null),", "mois.push({ ym, ca: l ? r2(Number(l.ca) || 0) : 0,"],
  // Un CA calculé avant la fin de l'année présenté complet.
  'avant-fin-tu': ['cl', 'const partiel = C.partiel || avantFin;', 'const partiel = C.partiel;'],
  // Un second calcul du CA (somme des mois) au lieu de `caAnnee`.
  'second-calcul': ['cl', "return { cle: 'ca', etat: partiel ? 'manque' : 'ok', n: null, ca: C.ca,", "return { cle: 'ca', etat: partiel ? 'manque' : 'ok', n: null, ca: r2(mois.reduce((s, m) => s + (m.ca || 0), 0)),"],
  // Les prix manquants ne comptent plus.
  'prix-tus': ['cl', "const n = Math.max(0, sur - (Number(B && B.nCout) || 0));", 'const n = 0;'],
  // La carte de Ma journée aussi en février.
  'journee-fevrier': ['cl', 'if (!(m === 11 || m === 0)) return null;', 'if (!(m === 11 || m <= 4)) return null;'],
  // La carte de Ma journée revient après avoir été vue.
  'journee-encore': ['cl', "if (vue && typeof vue === 'object' && vue[String(annee)]) return null;", ''],
  // La liste n'est plus montée dans Déclarer.
  'pas-montee': ['compta', '<ClotureAnnee portes={portesCloture({ onNav })} />', ''],
  // La carte de Ma journée n'est plus poussée.
  'pas-journee': ['app', "jobs.push({ id: 'cloture-annee',", "void ({ id: 'cloture-annee',"],
  // L'écran écrit tout seul (au rendu) l'année clôturée.
  'ecrit-seul': ['jsx', "  if (!K) return null;\n", "  if (!K) return null;\n  if (K.etat === 'pret') save(CLE_CLOTURE, { [String(K.annee)]: { at: 1 } });\n"],
};

if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', env: process.env });
    const rouge = r.status === 1;
    if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} : ${rouge ? 'rouge' : 'PAS rouge (statut ' + r.status + ')'}${rouge ? '' : '\n' + (r.stdout || '').slice(-400)}`);
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${rouges === n ? '✅' : '❌'} audit-cloture-annee --prouve : ${rouges}/${n} mutations rougissent`);
  process.exit(rouges === n ? 0 : 1);
}

let APP = require('./_source-app.cjs').sourceApp(R);
const SRC = { cl: lire('src/clotureAnnee.js'), jsx: lire('src/ClotureAnnee.jsx'), compta: lire('src/ecrans/Compta.jsx'), app: APP };
if (MUT) {
  const m = MUTATIONS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  if (!SRC[m[0]].includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  SRC[m[0]] = SRC[m[0]].replace(m[1], m[2]);
  if (m[0] === 'app') APP = SRC.app;
}
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
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
const charger = async (texte, nom, dossier = 'src') => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte.replace(/from '(\.\.?\/[^']+)'/g, (m, f) => `from 'file://${path.join(R, dossier, f)}'`));
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const proche = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

(async () => {
  console.log('── Les modules et les règles des propriétaires');
  let CL = null; try { CL = await charger(SRC.cl, 'cloture'); if (typeof CL.clotureAnnee !== 'function') CL = null; } catch (e) { CL = null; console.log(e.message); }
  dit(!!CL, 'src/clotureAnnee.js exporte `clotureAnnee`');
  let ME = null; try { ME = await charger(lire('src/microEntreprise.js'), 'micro'); } catch (_) { ME = null; }
  let SA = null; try { SA = await charger(lire('src/seuilsAnnee.js'), 'seuils'); } catch (_) { SA = null; }
  let BN = null; try { BN = await charger(lire('src/beneficeNoms.js'), 'noms'); } catch (_) { BN = null; }
  dit(!!(ME && SA && BN), 'microEntreprise, seuilsAnnee, beneficeNoms se chargent');
  const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours',
    'moisPeriodeUrssaf', 'minuitParisMs', 'aPayerUrssaf', 'montantPeriodeUrssaf', 'moisDeclare'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, Intl, tauxUrssaf: () => 12.4, console };
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les règles se lisent dans App.jsx', absents.join(', '));
  if (!CL || !ME || !SA || !BN || absents.length) { console.log(`\n❌ audit-cloture-annee : ${ok} vert(s), ${ko + 1} rouge(s)`); process.exit(1); }

  const RG = { caAnnee: ME.caAnnee, declarationRevenus: ME.declarationRevenus, jaugeSeuils: ME.jaugeSeuils, dac7ParPlateforme: SA.dac7ParPlateforme,
    montantPeriodeUrssaf: ctx.montantPeriodeUrssaf, moisDeclare: ctx.moisDeclare, beneficeDesJours: ctx.beneficeDesJours, moisCouvert: BN.moisCouvertParPublication };
  const T = (y, m, j, h = 12) => new Date(y, m, j, h).getTime();
  const E = (K, cle) => K.etapes.find((e) => e.cle === cle) || {};

  console.log('── Quand : de décembre à mai ; Ma journée en décembre et janvier, une fois');
  dit(CL.anneeACloturer(T(2026, 11, 3)) === 2026 && CL.anneeACloturer(T(2027, 2, 3)) === 2026 && CL.anneeACloturer(T(2027, 4, 31)) === 2026, 'décembre ⇒ l’année en cours ; janvier à mai ⇒ celle qui vient de finir');
  dit(CL.anneeACloturer(T(2027, 5, 1)) === null && CL.anneeACloturer(T(2026, 10, 11)) === null, 'de juin à novembre : rien');
  const cj = (o) => CL.carteJournee({ regime: 'micro', cloture: {}, vue: {}, ...o });
  dit(!!cj({ maintenant: T(2026, 11, 2) }) && !!cj({ maintenant: T(2027, 0, 20) }), 'Ma journée : en décembre et en janvier');
  dit(!cj({ maintenant: T(2027, 1, 2) }) && !cj({ maintenant: T(2027, 3, 2) }), 'Ma journée : plus en février ni ensuite (la liste reste dans Argent)');
  dit(!cj({ maintenant: T(2026, 11, 2), vue: { 2026: 1 } }), 'Ma journée : une fois (l’année vue ne revient pas)');
  dit(!cj({ maintenant: T(2026, 11, 2), cloture: { 2026: { at: 5 } } }), 'Ma journée : pas pour une année clôturée');
  dit(!cj({ maintenant: T(2026, 11, 2), regime: 'particulier' }) && !cj({ maintenant: T(2026, 11, 2), regime: undefined }), 'Ma journée : ni pour un particulier, ni avant d’avoir lu le statut');

  console.log('── Une année 2026 regardée le 15 janvier 2027');
  const MAINT = T(2027, 0, 15, 15);
  const ligne = {
    at: T(2027, 0, 10),
    mois: [{ ym: '2026-01', ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }, { ym: '2026-06', ca: 1200.5, n: 9, par: { Vinted: { n: 8, ca: 1100.5 }, Leboncoin: { n: 1, ca: 100 } } },
      { ym: '2026-11', ca: 800, n: 6, par: { Vinted: { n: 6, ca: 800 } } }, { ym: '2027-01', ca: 50, n: 1, par: { Vinted: { n: 1, ca: 50 } } }],
    aDater: { n: 5, ca: 400, par: { Vinted: { n: 5, ca: 400 } }, annees: { 2026: { n: 3, ca: 240, par: { Vinted: { n: 3, ca: 240 } } }, 2027: { n: 2, ca: 160, par: { Vinted: { n: 2, ca: 160 } } } },
      raisons: [{ cle: 'vinted-detail', n: 4, ca: 320, comptes: [{ uid: '1', nom: 'atelier', n: 4 }] }, { cle: 'leboncoin', n: 1, ca: 80, comptes: [] }] },
    sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' },
  };
  const jours = {};
  const vend = (t, eur, achat) => { const k = ctx.jourClef(new Date(t)); const a = ctx.beneficeVide(); if (jours[k]) ctx.cumulerBenefice(a, jours[k]); ctx.ajouterVenteBenefice(a, eur, achat, 0); jours[k] = ctx.jourBeneficeEnTableau(a); };
  vend(T(2026, 2, 3), 120, 60); vend(T(2026, 5, 12), 150, null); vend(T(2026, 10, 25), 140, 50); vend(T(2027, 0, 5), 90, null);
  const inv31 = { at: T(2026, 11, 31, 18), partiel: false, v: { centimes: 54000, n: 6, nPrix: 6, nSans: 0 } };
  const base = { annee: 2026, maintenant: MAINT, ligne, joursBenef: { v: 2, jours }, inventaire: inv31, declare: { '2026-01': { ids: ['a'] }, '2026-02': { ids: ['a'] }, '2026-03': { ids: ['a'] }, '2026-04': { ca: 1 } },
    regime: 'micro', freq: 'trimestriel', taux: 12.4, liberatoire: 'non', activite: 'vente', cloture: {}, R: RG };
  const K = CL.clotureAnnee(base);
  dit(K && K.etapes.length === 8 && K.etapes.map((e) => e.cle).join() === 'adater,prix,inventaire,ca,urssaf,revenus,seuils,export', 'huit étapes, dans l’ordre', K && K.etapes.map((e) => e.cle).join());

  // 1. À dater : celles vendues en 2026 (ou avant) ; pas celles de 2027.
  dit(E(K, 'adater').etat === 'manque' && E(K, 'adater').n === 3 && E(K, 'adater').toutes === 5, '3 ventes à dater peuvent tomber en 2026 (les 2 vendues en 2027 non)', JSON.stringify(E(K, 'adater')));
  dit(E(K, 'adater').raisons.length === 2 && E(K, 'adater').raisons[0].cle === 'vinted-detail', 'les raisons publiées (lot DJ7) sont reprises telles quelles');
  // 2. Prix : n − nCout de `beneficeDesJours` sur l'année.
  const B = ctx.beneficeDesJours(jours, new Date(2026, 0, 1), new Date(2027, 0, 1));
  dit(E(K, 'prix').n === B.n - B.nCout && E(K, 'prix').n === 1 && E(K, 'prix').sur === 3, 'prix d’achat : 1 vente de 2026 sur 3 (`beneficeDesJours`, pas celle de 2027)', JSON.stringify(E(K, 'prix')));
  // 3. Inventaire lu le 31/12.
  dit(E(K, 'inventaire').etat === 'ok', 'inventaire lu LE 31 décembre, complet ⇒ ✓');
  // 4. CA = caAnnee.
  const C = ME.caAnnee(ligne, 2026);
  dit(proche(E(K, 'ca').ca, C.ca) && E(K, 'ca').partiel === C.partiel && C.partiel, `CA 2026 = \`caAnnee\` (${C.ca} €), « au moins » dit`, JSON.stringify(E(K, 'ca').raisons));
  const ms = E(K, 'ca').mois || [];
  dit(ms.length === 12 && proche(ms[0].ca, 300) && proche(ms[5].ca, 1200.5) && ms[1].ca === 0 && !ms.some((m) => m.ym.startsWith('2027')), 'douze mois datés au versement ; un mois lu sans versement = 0 ; janvier 2027 hors de 2026');
  // 5. URSSAF : T1 déclaré, T2 pas tout, T3, T4 pas déclarés ⇒ 3 restants, reste = montantPeriodeUrssaf.
  const U = E(K, 'urssaf');
  const due = (a, b) => ({ periodStart: new Date(2026, a, 1), periodEnd: new Date(2026, b + 1, 0) });
  const attendu = [due(3, 5), due(6, 8), due(9, 11)].map((d) => ctx.montantPeriodeUrssaf(d, ligne, 12.4).apayer).reduce((s, x) => s + x, 0);
  dit(U.etat === 'manque' && U.faites === 1 && U.sur === 4 && U.n === 3, 'URSSAF : 1/4 trimestres notés déclarés (registre `moisDeclare`)', JSON.stringify({ f: U.faites, n: U.n }));
  dit(proche(U.reste, Math.round(attendu * 100) / 100) && U.restePartiel === true, `reste estimé = Σ \`montantPeriodeUrssaf\` des périodes pas déclarées (${U.reste} €, au moins)`);
  const Um = E(CL.clotureAnnee({ ...base, freq: 'mensuel' }), 'urssaf');
  dit(Um.sur === 12 && Um.faites === 3, 'rythme mensuel : 12 mois, 3 notés');
  dit(E(CL.clotureAnnee({ ...base, declare: undefined }), 'urssaf').etat === 'encours', 'registre pas encore lu ⇒ en cours');
  // 6. Revenus : declarationRevenus, case selon SA réponse.
  const dr = ME.declarationRevenus({ ligne, now: new Date(2026, 11, 31, 12), liberatoire: 'non' });
  dit(proche(E(K, 'revenus').ca, dr.ca) && proche(dr.ca, C.ca) && E(K, 'revenus').cases.join() === '5KO', 'revenus 2026 : `declarationRevenus` (= le CA de l’année), case 5KO sans versement libératoire');
  dit(E(CL.clotureAnnee({ ...base, liberatoire: 'oui' }), 'revenus').cases.join() === '5TA', 'avec versement libératoire : 5TA');
  const Rn = E(CL.clotureAnnee({ ...base, liberatoire: null }), 'revenus');
  dit(Rn.etat === 'manque' && Rn.raison === 'liberatoire' && Rn.cases.length === 2, 'pas répondu ⇒ « réponds d’abord », jamais une case choisie', JSON.stringify(Rn.cases));
  dit(E(K, 'revenus').aReverifier === true, 'revenus 2026 plus récents que la notice lue ⇒ « à revérifier sur la notice de l’année »');
  // 7. Seuils et DAC7.
  const D = SA.dac7ParPlateforme({ ligne, annee: 2026 });
  const S = E(K, 'seuils');
  dit(S.dac7.length === D.plateformes.length && S.dac7.every((p, i) => p.verdict === D.plateformes[i].verdict && p.n === D.plateformes[i].n), 'DAC7 = `dac7ParPlateforme` de 2026', JSON.stringify(S.dac7));
  const J = ME.jaugeSeuils({ ligne, now: new Date(2026, 11, 31, 12), activite: 'vente' });
  dit(S.tva === J.tva.etat && S.plafond === J.plafond.etat && proche(S.ca, J.ca), 'seuils = `jaugeSeuils` au 31/12/2026');
  const gros = { ...ligne, mois: [...ligne.mois, { ym: '2026-09', ca: 90000, n: 400, par: { Vinted: { n: 400, ca: 90000 } } }] };
  dit(E(CL.clotureAnnee({ ...base, ligne: gros }), 'seuils').etat === 'alerte', 'TVA dépassée ⇒ à regarder (ambre), jamais « ✓ »');
  // 8. Export : jamais coché.
  dit(E(K, 'export').etat === 'geste', 'export : VRM ne sait pas s’il est parti ⇒ jamais ✓');
  dit(K.etat === 'afaire' && K.aFaire >= 4, 'des étapes à faire ⇒ pas prêt', K.etat);

  console.log('── « Pas su » ≠ « ✓ »');
  const K0 = CL.clotureAnnee({ ...base, ligne: null });
  dit(['adater', 'ca', 'seuils'].every((c) => E(K0, c).etat === 'passu') && E(K0, 'revenus').etat === 'passu', 'CA pas publié ⇒ « — » partout où il sert, aucun montant');
  dit(E(CL.clotureAnnee({ ...base, ligne: undefined }), 'ca').etat === 'encours' && CL.clotureAnnee({ ...base, ligne: undefined }).etat === 'encours', 'CA en lecture ⇒ en cours');
  dit(E(CL.clotureAnnee({ ...base, joursBenef: null }), 'prix').etat === 'passu', 'bénéfice pas publié ⇒ prix « — »');
  dit(E(CL.clotureAnnee({ ...base, inventaire: null }), 'inventaire').etat === 'passu', 'inventaire jamais publié ⇒ « — »');
  dit(E(CL.clotureAnnee({ ...base, inventaire: { ...inv31, at: T(2027, 0, 5) } }), 'inventaire').etat === 'passu', 'liste lue le 5 janvier ⇒ pas su (VRM ne reconstitue pas le 31/12)');
  dit(E(CL.clotureAnnee({ ...base, inventaire: { ...inv31, v: { ...inv31.v, nSans: 2 } } }), 'inventaire').n === 2, '2 paires sans prix au 31/12 ⇒ « 2 »');
  dit(E(CL.clotureAnnee({ ...base, maintenant: T(2026, 11, 10) }), 'inventaire').etat === 'attente', 'le 10 décembre : « à faire le 31 décembre »');
  const Kreg = CL.clotureAnnee({ ...base, regime: null });
  dit(E(Kreg, 'urssaf').etat === 'passu' && E(Kreg, 'revenus').etat === 'passu', 'statut pas choisi ⇒ « choisis ton statut », jamais deviné');
  dit(E(CL.clotureAnnee({ ...base, regime: 'societe' }), 'revenus').etat === 'na', 'société : sans objet (le comptable)');
  const lAvant = { ...ligne, aDater: { n: 0, ca: 0 }, at: T(2026, 11, 20) };
  const Ka = E(CL.clotureAnnee({ ...base, ligne: lAvant }), 'ca');
  dit(Ka.partiel && Ka.avantFin && Ka.mois[11].ca === null, 'CA publié le 20 déc. ⇒ « au moins », décembre « — »');
  // Les ventes à dater vendues ET lues finalisées en 2026 sont versées en 2026 : `caAnnee` les compte, pas les mois.
  const lSur = { ...ligne, at: T(2026, 11, 31, 22) };
  const Cs = ME.caAnnee(lSur, 2026);
  const Ks = E(CL.clotureAnnee({ ...base, ligne: lSur }), 'ca');
  dit(Cs.aDaterSur && proche(Ks.ca, Cs.ca) && !proche(Ks.ca, Ks.mois.reduce((x, m) => x + (m.ca || 0), 0)), `le CA de l’année est \`caAnnee\` (${Cs.ca} €, dont les ventes à dater prouvées de 2026), pas la somme des mois`);
  // Un tout-vert, pour prouver que « prêt » existe — puis un pas su suffit à l'empêcher.
  const net = { ...ligne, aDater: { n: 0, ca: 0 }, at: T(2027, 0, 10) };
  const tout = { ...base, ligne: net, joursBenef: { v: 2, jours: { [ctx.jourClef(new Date(T(2026, 2, 3)))]: jours[ctx.jourClef(new Date(T(2026, 2, 3)))] } },
    declare: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-${String(i + 1).padStart(2, '0')}`, { ids: [] }])) };
  const Kp = CL.clotureAnnee(tout);
  dit(Kp.etat === 'pret', 'tout lu et réglé ⇒ « prêt » (l’export reste à son geste)', JSON.stringify(Kp.etapes.map((e) => e.cle + ':' + e.etat)));
  dit(CL.clotureAnnee({ ...tout, joursBenef: null }).etat === 'passu', 'un seul « pas su » ⇒ jamais « prêt »');
  dit(CL.clotureAnnee({ ...tout, cloture: { 2026: { at: 99 } } }).etat === 'cloturee', 'l’année notée clôturée (son clic) ⇒ « clôturée »');
  const rec = CL.enregistrementCloture(K, 1234);
  dit(rec.at === 1234 && rec.etapes.adater === 'manque' && rec.etapes.export === 'geste', '« J’ai fini » range la date et l’état constaté de chaque étape');

  console.log('── L’écran : la forme, aucune règle, aucune écriture hors de son clic');
  const jsx = sansCommentaires(SRC.jsx), cl = sansCommentaires(SRC.cl);
  dit(!/\bsave\(|localStorage|fetch\(/.test(cl), 'src/clotureAnnee.js : aucune écriture ni lecture réseau');
  const saves = (jsx.match(/\bsave\(/g) || []).length;
  dit(saves === 2 && /const finir = async \(\) => \{[\s\S]*?askConfirm[\s\S]*?save\(CLE_CLOTURE/.test(jsx) && /const rouvrir = \(\) => \{[^\n]*save\(CLE_CLOTURE/.test(jsx), 'l’écran n’écrit que dans « J’ai fini » (confirmé) et « Rouvrir »', String(saves));
  dit(/REGLES_CLOTURE = \{ caAnnee, declarationRevenus, jaugeSeuils, dac7ParPlateforme, montantPeriodeUrssaf, moisDeclare, beneficeDesJours, moisCouvert: moisCouvertParPublication \}/.test(jsx), 'l’écran passe les règles des propriétaires (aucun calcul à part)');
  dit(!/\.reduce\(/.test(jsx), 'l’écran ne somme rien lui-même');
  dit(!/encaiss/i.test(jsx + cl), 'jamais « encaissé »');
  dit(/<ClotureAnnee portes=\{portesCloture\(\{ onNav \}\)\} \/>/.test(sansCommentaires(SRC.compta)), 'la liste est montée dans Argent → Déclarer');
  dit(/jobs\.push\(\{ id: 'cloture-annee',[^\n]*tab: 'argent_declarer'/.test(sansCommentaires(SRC.app)) && /carteJourneeCloture\(\{/.test(SRC.app), 'la carte de Ma journée est poussée par `carteJournee` et ouvre Déclarer');
  const portes = extraire(SRC.compta, 'portesCloture');
  dit(['adater', 'prix', 'inventaire', 'ca', 'urssaf', 'revenus', 'seuils', 'export'].every((k) => new RegExp(`\\b${k}: `).test(portes)), 'chaque étape a sa porte vers l’écran existant');
  dit(/'vrm_cloture_annee', 'vrm_cloture_vue'/.test(APP), 'clôture et carte vue : synchronisées (SYNC_KEYS)');

  console.log(`\n${ko ? '❌' : '✅'} audit-cloture-annee : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
