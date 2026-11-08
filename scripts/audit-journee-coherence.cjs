// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « MA JOURNÉE ET LES CARTES SOMBRES » — chantier E1 (5 nov.), les règles
//  qui se jugent SANS rendu (le banc scripts/bancs/journee-coherence.cjs juge
//  l'écran). Il EXÉCUTE les vrais modules (copiés dans un dossier temporaire,
//  mutés au besoin) et lit src/App.jsx sans ses commentaires.
//   A1 ARGENT   — la carte « À venir / À virer » s'affiche dès qu'UN des deux est
//                 connu et non nul ; « pas su » reste « — » (jamais 0) ; rien de
//                 connu ⇒ pas de carte (src/journeeArgent.js), et Ma journée s'en sert ;
//   A2 REÇU     — « Reçu · mois » : des ventes à dater et rien de daté ⇒ « — » et la
//                 raison (« 2 à dater ») ; un montant daté garde son manque nommé ;
//                 vraiment rien (rien à dater) ⇒ 0 (lu) ;
//   A3 RAISON   — chaque « — » de la carte a une raison courte, jamais vide ;
//   A4 GESTES   — « N gestes » compte TOUTES les cartes de la liste, « Vendus
//                 ailleurs » et la sortie du Stock comprises ; « Vendus ailleurs »
//                 n'est plus rendu hors de la liste ;
//   A5 VERBE    — Ma journée n'écrit plus « Ouvrir le détail », « Lire les messages »,
//                 « Voir les baisses »… : un seul verbe (« Voir ») ;
//   A6 STOCK    — la sortie du Stock lit la règle du Stock (`classerRangees`) et la
//                 règle de départ (`venteSortieDuStock`), sans la recopier.
//  `--mutation` : chaque règle affaiblie une à une — l'audit DOIT rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = {
  virer: ['src/journeeArgent.js', "if (venir.etat !== 'val' && virer.etat !== 'val') return null;", "if (venir.etat !== 'val') return null;"],
  passu: ['src/journeeArgent.js', "const virer = d == null ? { etat: 'pasSu', valeur: null, raison: 'porte-monnaie pas lu' }", "const virer = d == null ? { etat: 'val', valeur: 0 }"],
  adater: ['src/design/carteChiffres.js', "if (nAd > 0 && !(R.valeur > 0)) return vide('a-dater', { p, aDater: nAd });", ''],
  raison: ['src/design/carteChiffres.js', "return RAISON_COURTE[x.raison] || 'pas lu';", "return RAISON_COURTE[x.raison] || '';"],
  gestes: ['src/App.jsx', '+ (carteAilleurs ? 1 : 0) + (sortiesStock.length ? 1 : 0)', ''],
  verbe: ['src/App.jsx', "const gesteCaseF = { envoyer: nPretsJournee > 0 ? VERBES.imprimer : VERBES.voir };", "const gesteCaseF = { envoyer: nPretsJournee > 0 ? VERBES.imprimer : VERBES.voir, retirer: 'Voir les retraits' };"],
  stock: ['src/App.jsx', "const etats = classerRangees({ slots, actuelles: null, vendus: new Set(pub.nums.map(cleNum).filter(Boolean)), garder: null, jugeable: null, cle: cleNum });", "const etats = Object.fromEntries(Object.keys(slots).map((k) => [k, 'vendue']));"],
};

async function passe(mut) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!mut && (!c || process.env.BAVARD)) console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
  const src = { 'src/journeeArgent.js': lire('src/journeeArgent.js'), 'src/design/carteChiffres.js': lire('src/design/carteChiffres.js'), 'src/argentAVenir.js': lire('src/argentAVenir.js'), 'src/App.jsx': lire('src/App.jsx') };
  if (mut) {
    const [f, avant, apres] = MUTATIONS[mut];
    if (!src[f].includes(avant)) return { ko: -1, ok, raison: 'motif absent : ' + avant.slice(0, 80) };
    src[f] = src[f].replace(avant, apres);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-e1-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  for (const f of ['src/journeeArgent.js', 'src/design/carteChiffres.js', 'src/argentAVenir.js']) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), src[f]); }
  let JA = {}, CC = {};
  try { JA = await import(pathToFileURL(path.join(tmp, 'src/journeeArgent.js')).href); } catch (e) { dit(false, 'A1 src/journeeArgent.js se charge', e.message); }
  try { CC = await import(pathToFileURL(path.join(tmp, 'src/design/carteChiffres.js')).href); } catch (e) { dit(false, 'A2 carteChiffres.js se charge', e.message); }

  // A1 — la carte « À venir / À virer ».
  const K = JA.carteArgentJournee || (() => undefined);
  const venir = (valeur, extra = {}) => ({ valeur, partiel: false, manque: [], ...extra });
  const virer = (dispo) => ({ dispo, accounts: 1 });
  let k = K({ aVenir: venir(0), aVirer: virer(64) });
  dit(!!k && k.montrerVirer && !k.montrerVenir && k.virer.valeur === 64, 'A1 seulement de l’argent À VIRER (64 €, rien à venir) : la carte s’affiche, avec « À virer »', JSON.stringify(k));
  k = K({ aVenir: venir(null, { raison: 'pasSu' }), aVirer: virer(64) });
  dit(!!k && k.montrerVenir && k.venir.valeur === null && !!k.venir.raison && k.virer.valeur === 64, 'A1 à virer 64 € et « à venir » pas su : la carte s’affiche, « à venir » = « — » avec sa raison (jamais 0)', JSON.stringify(k));
  k = K({ aVenir: venir(120), aVirer: null });
  dit(!!k && k.venir.valeur === 120 && k.virer.valeur === null && k.montrerVirer && !!k.virer.raison, 'A1 à venir 120 €, porte-monnaie jamais lu : « à virer » = « — » avec sa raison', JSON.stringify(k));
  k = K({ aVenir: venir(80, { partiel: true, manque: ['eBay'] }), aVirer: virer(0) });
  dit(!!k && k.venir.partiel && k.montrerVenir && !k.montrerVirer, 'A1 à venir « au moins » 80 €, à virer 0 lu : la carte, sans moitié à zéro', JSON.stringify(k));
  dit(K({ aVenir: venir(0), aVirer: virer(0) }) === null, 'A1 les deux lus et nuls : pas de carte');
  dit(K({ aVenir: venir(null), aVirer: null }) === null, 'A1 rien de connu : pas de carte (pas de « — » partout)');
  dit(K({ aVenir: venir(120), aVirer: virer(64), enCours: true }) === null, 'A1 lecture en cours : pas de carte');
  const app = sansCommentaires(src['src/App.jsx']);
  const wAtt = (app.split('W.attente = ')[1] || '').split('W.recentes = ')[0];
  dit(/carteArgentJournee\(\{ aVenir: aVenirJ, aVirer: escrowJ/.test(wAtt) && !/!\(val>0\|\|aVenirJ\.partiel\)/.test(wAtt), 'A1 Ma journée décide la carte par `carteArgentJournee` (plus « seulement s’il y a de l’argent à venir »)');

  // A2 / A3 — « Reçu · mois ».
  const maintenant = Date.UTC(2026, 10, 5, 12);
  const ym = '2026-11';
  const pub = (recu, n) => ({ mois: [], at: maintenant - 3600e3, recu, sources: { Vinted: 'lu' }, aDater: { n, ca: n * 50, par: {} } });
  const V = (p) => (CC.valeurChiffre ? CC.valeurChiffre('recu', { id: 'recu', p: 'mois' }, { ligneUrssaf: p }, { site: 'toutes' }, REGLES, maintenant) : null);
  // Les bornes du mois, comme l'app les donne (`debutPeriode`, `decalerPeriode`).
  const REGLES = { debutPeriode: (t, p) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(1); return d; }, decalerPeriode: (d, p, k) => { const e = new Date(d); e.setMonth(e.getMonth() + k); return e; } };
  const RC = CC.raisonCourte || (() => '');
  let x = V(pub({}, 2));
  dit(!!x && x.valeur === null && x.raison === 'a-dater' && RC(x) === '2 à dater', 'A2 rien de daté ce mois, 2 ventes à dater : « — » et « 2 à dater » (jamais 0 €)', JSON.stringify(x) + ' ' + RC(x));
  x = V(pub({ [ym]: 40 }, 2));
  dit(!!x && x.valeur === 40 && RC(x) === '+ 2 à dater', 'A2 40 € datés ce mois et 2 à dater : le montant, le manque nommé', JSON.stringify(x) + ' ' + RC(x));
  x = V(pub({}, 0));
  dit(!!x && x.valeur === 0 && RC(x) === '', 'A2 rien à dater et rien de reçu : 0 lu (pas de raison inventée)', JSON.stringify(x));
  for (const r of ['pasSu', 'encours', 'publication', 'achats', 'frais', 'cotisations', 'rien', 'absente', 'ancienne', 'illisible', 'inconnue-demain']) {
    const t = RC({ valeur: null, raison: r });
    dit(typeof t === 'string' && t.trim().length > 0, `A3 « — » (${r}) : une raison courte (« ${t} »)`);
  }
  dit(RC({ valeur: null, raison: 'partiel', manque: ['eBay'] }) === 'sans eBay', 'A3 partiel : le manque nommé (« sans eBay »)');
  const stats = sansCommentaires(lire('src/design/CarteStats.jsx')), mois = sansCommentaires(lire('src/design/CarteMois.jsx'));
  dit(/raison: raisonCourte\(x\)/.test(stats) && /data-carte-raison/.test(mois), 'A3 la carte passe la raison à chaque case, et la case l’écrit (`data-carte-raison`)');

  // A4 / A5 / A6 — Ma journée (source, sans commentaires).
  const BAVARD_A4 = !!process.env.BAVARD;
  const z0 = (app.split('const libCase = (id, n)')[1] || '').split('Les cases à zéro restent lisibles')[0] || app.split('const libCase = (id, n)')[1] || '';
  // (8 nov., « beauté ») La première carte devient « la prochaine chose à faire » : chaque carte passe par
  // `P(…)` (la même carte, une classe en plus). La règle se juge sur la carte, pas sur l'enveloppe.
  const z = z0.replace(/\bP\((carte\w+\(\)|tache\([^()]*\))\)/g, '$1');
  // (6 nov., vague 3) + la carte « en ligne deux fois » (`deuxFois`, src/enLigneDeuxFois.js).
  // (8 nov.) La règle, plus une liste figée : CHAQUE carte rendue dans la liste « À faire »
  // (`{cond ? carteX() : null}`, `{liste.map(…)}`, `{urssafJob ? tache(…) : null}`) a son terme
  // dans `nGestes` — la carte « Relier la boîte » (6 nov., `comptesARelierJour`) en est une.
  // Les cartes nommées depuis le 4 nov. restent exigées (dont « en ligne deux fois »).
  const exprGestes = (/const nGestes = ([^;]+);/.exec(z) || [])[1] || '';
  const termes = exprGestes.split('+').map((t) => t.trim().replace(/^\((.*)\)$/, '$1'));
  const compte = (t) => termes.includes(t);
  const listeAFaire = (z.split('data-barre-jour=""')[1] || '').split('</div>\n')[0];
  const rendues = [];
  for (const m of listeAFaire.matchAll(/\{(\w+(?:\.length)?) \? (?:carte\w+\(\)|tache\([^)]*\)|<div[^]*?) : null\}/g)) rendues.push(m[1].endsWith('.length') && /alertesArgent/.test(m[1]) ? m[1] : (m[1].endsWith('.length') ? m[1] + ' ? 1 : 0' : m[1] + ' ? 1 : 0'));
  for (const m of listeAFaire.matchAll(/\{(\w+)\.map\(/g)) rendues.push(m[1] + '.length');
  const nonComptees = rendues.filter((t) => !compte(t));
  const exigees = ['cases.length', 'alertesArgent.length', 'autres.length', 'urssafJob ? 1 : 0', 'carteAilleurs ? 1 : 0', 'sortiesStock.length ? 1 : 0', 'deuxFois.length ? 1 : 0'];
  dit(exprGestes && rendues.length >= exigees.length && !nonComptees.length && exigees.every(compte) && /\{deuxFois\.length \? carteDeuxFois\(\) : null\}/.test(z), 'A4 « N gestes » compte toutes les cartes (dont « Vendus ailleurs », la sortie du Stock et « en ligne deux fois »)', nonComptees.length ? 'rendues sans être comptées : ' + nonComptees.join(', ') : (BAVARD_A4 ? rendues.join(' · ') : ''));
  dit(/\{carteAilleurs \? carteVendusAilleurs\(\) : null\}/.test(z) && /\{sortiesStock\.length \? carteSortieStock\(\) : null\}/.test(z), 'A4 les deux cartes sont rendues DANS la liste');
  const zoneJournee = (app.split("className=\"vrm-day-layout vrm-fu-ecran vrm-fu-journee\"")[1] || '').split("{!only && (")[0];
  dit(zoneJournee.length > 0 && !/<VendusAilleurs /.test(zoneJournee), 'A4 « Vendus ailleurs » n’est plus un repli posé sous la journée');
  const corpsJ = (app.split('const ICONE_JOURNEE')[1] || '').split('{!only && (')[0];
  const mauvais = ['Ouvrir le détail', 'Lire les messages', 'Voir les baisses', 'Voir les retraits', 'Ouvrir les colis'].filter((m) => corpsJ.includes(`'${m}'`));
  dit(corpsJ.length > 0 && !mauvais.length, 'A5 un seul verbe pour ouvrir un écran (« Voir ») dans Ma journée', mauvais.join(', '));
  dit(/classerRangees\(\{ slots, actuelles: null, vendus:/.test(z) && /venteSortieDuStock\(o\)/.test(z) && /ouDansMeubles\(k, meubles, slots\)/.test(z), 'A6 la sortie du Stock lit `classerRangees`, `venteSortieDuStock` et `ouDansMeubles` (aucune recopie)');
  dit(!/etats\[k\] === 'vendue' && parties\.has\(k\)/.test(z) ? false : true, 'A6 seule une case « vendue » ET une vente partie font la carte');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return { ko, ok };
}

(async () => {
  const base = await passe('');
  console.log(base.ko ? `❌ audit-journee-coherence : ${base.ko} défaut(s), ${base.ok} vert(s)` : `✅ audit-journee-coherence : ${base.ok} contrôles verts`);
  let mutKo = 0;
  if (process.argv.includes('--mutation')) {
    for (const m of Object.keys(MUTATIONS)) {
      const r = await passe(m);
      const rouge = r.ko > 0;
      if (!rouge) mutKo++;
      console.log(`   mutation « ${m} » : ${r.ko < 0 ? 'impossible (' + r.raison + ')' : rouge ? `rouge (${r.ko})` : 'VERTE — le contrôle ne la voit pas'}`);
      if (r.ko < 0) mutKo++;
    }
    console.log(mutKo ? `❌ ${mutKo} mutation(s) non vue(s)` : `✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations rouges`);
  }
  process.exit(base.ko || mutKo ? 1 : 0);
})();
