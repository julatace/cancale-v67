// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LE BORDEREAU D'UNE VENTE VUE PAR E-MAIL » (8 nov.)
//  Récit : docs/passation/2026-11-08-bordereau-des-email.md ; règle :
//  src/bordereauVenteEmail.js ; banc : scripts/bancs/bordereau-des-email.cjs.
//  EXÉCUTE la règle (module) ET la fonction de l'app `numeroVenteEmail`
//  (extraite de src/App.jsx, lancée avec ses voisins remplacés par des doubles) :
//   §1 le colis : vente e-mail + bordereau du MÊME n° ⇒ un colis ; autre n°, sans
//      PDF, connue de la liste Vinted, masquée, partie ⇒ rien ;
//   §2 la décision du N° : aucune source ⇒ sans ; une ⇒ elle ; deux différentes
//      ⇒ aucune ; « 007 » = « 7 » ;
//   §3 le N° écrit : « … n12 » dans le titre reçu ⇒ 12 ; un `numero` absent du
//      titre (retrouvé PAR TITRE) ⇒ rien ;
//   §4 l'app : 50 ventes e-mail au MÊME titre, chaque bordereau portant un N°
//      retrouvé par titre ⇒ AUCUN N° ; chacune son « nK » écrit ⇒ chacune SON K ;
//      N° posé sur la transaction ⇒ lui ; posé ≠ écrit ⇒ aucun ;
//   §5 le câblage : Colis (`expeditionsCalc`), Ma journée (`toShip`), le
//      filtre de Ventes, `numForBord` et `effEntry` passent par la règle ; la
//      notification du serveur ne nomme que le N° LU.
//  `--prouve` : chaque mutation de la règle doit rendre l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { sourceApp } = require('./_source-app.cjs');
const RACINE = path.join(__dirname, '..');

async function auditer({ module: modSrc, app, serveur }) {
  let ko = 0, ok = 0;
  const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
  // Le module, chargé depuis un dossier temporaire (le texte peut être muté).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bde-'));
  fs.writeFileSync(path.join(tmp, 'numeroEcrit.js'), fs.readFileSync(path.join(RACINE, 'src', 'numeroEcrit.js'), 'utf8'));
  fs.writeFileSync(path.join(tmp, 'bordereauVenteEmail.js'), modSrc);
  let M;
  try { M = await import(pathToFileURL(path.join(tmp, 'bordereauVenteEmail.js')).href + '?t=' + Math.random()); }
  catch (e) { M = {}; dit(false, 'le module se charge', e.message); }
  // Un audit ne meurt pas : une fonction absente (code d'avant) rend un faux résultat, compté rouge.
  const sur = (f, vide) => (...x) => { try { return typeof f === 'function' ? f(...x) : vide; } catch (_) { return vide; } };
  M = { colisVentesEmail: sur(M.colisVentesEmail, []), decisionNumeroVenteEmail: sur(M.decisionNumeroVenteEmail, { etat: '?', numero: '?' }),
    numeroEcritDansArticle: sur(M.numeroEcritDansArticle, '?'), phraseImprimeSansNumero: sur(M.phraseImprimeSansNumero, '') };
  dit(Object.values(M).length === 4 && modSrc.includes('export function colisVentesEmail'), 'la règle existe (src/bordereauVenteEmail.js)');

  // §1 le colis
  const ve = (tx, x = {}) => ({ transaction_id: tx, title: 'Nike Dunk Low panda taille 42', _venteEmail: true, ...x });
  const bd = (tx, x = {}) => ({ transaction: tx, hasPdf: true, filename: 'b.pdf', ...x });
  const C = (o) => M.colisVentesEmail(o).map((c) => c.txn).join(',');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('101') } }) === '101', '§1 vente e-mail + bordereau du même n° ⇒ un colis');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 102: bd('102') } }) === '', '§1 bordereau d’un autre n° ⇒ rien');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('999') } }) === '', '§1 la ligne rangée sous 101 mais portant un autre n° ⇒ rien (identité)');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('101', { hasPdf: false, filename: 'None' }) } }) === '', '§1 bordereau sans PDF ⇒ rien');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('101') }, connues: (t) => t === '101' }) === '', '§1 la liste Vinted porte le n° ⇒ sa ligne gagne (rien ici)');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('101') }, cachee: () => true }) === '', '§1 vente masquée ⇒ rien');
  dit(C({ ventesEmail: [ve('101')], bordsParTx: { 101: bd('101') }, partie: () => true }) === '', '§1 colis parti (preuve) ⇒ rien');
  dit(C({ ventesEmail: [{ ...ve('101'), _venteEmail: false }], bordsParTx: { 101: bd('101') } }) === '', '§1 une ligne qui n’est pas une vente e-mail ⇒ rien');
  dit(C({ ventesEmail: [ve('101'), ve('101')], bordsParTx: { 101: bd('101') } }) === '101', '§1 deux lignes du même n° ⇒ un seul colis');
  dit(C({ ventesEmail: null, bordsParTx: { 101: bd('101') } }) === '' && C({ ventesEmail: [ve('101')], bordsParTx: null }) === '', '§1 pas su (null) ⇒ rien');

  // §2 la décision
  const D = M.decisionNumeroVenteEmail;
  dit(D([]).etat === 'sans' && D([]).numero === '', '§2 aucune source ⇒ sans N°');
  dit(D([{ source: 'ecrit', numero: '12' }]).numero === '12', '§2 une source ⇒ son N°');
  dit(D([{ source: 'transaction', numero: '007' }, { source: 'ecrit', numero: '7' }]).etat === 'sur', '§2 « 007 » et « 7 » : la même clé');
  { const d = D([{ source: 'transaction', numero: '12' }, { source: 'annonce', numero: '13' }]); dit(d.etat === 'contredit' && d.numero === '', '§2 deux N° différents ⇒ aucun', JSON.stringify(d)); }

  // §3 le N° écrit dans le titre reçu
  const E = M.numeroEcritDansArticle;
  dit(E({ article: 'Nike Dunk Low panda taille 42 n12', numero: '12' }) === '12', '§3 « n12 » dans le titre ⇒ 12');
  dit(E({ article: 'Nike Dunk Low panda taille 42', numero: '30' }) === '', '§3 N° absent du titre (retrouvé par titre) ⇒ rien');
  dit(E({ article: 'Nike Dunk Low panda n12', numero: '13' }) === '', '§3 titre et N° qui diffèrent ⇒ rien');
  dit(E({ article: 'Nike Dunk Low panda N°12', numero: '12' }) === '12', '§3 « N°12 » ⇒ 12');
  dit(E(null) === '' && E({ article: 'x n12' }) === '', '§3 rien à lire ⇒ rien');
  dit(M.phraseImprimeSansNumero({ 101: 'x' }, '101', '') !== '' && M.phraseImprimeSansNumero({ 101: 'x' }, '101', '12').includes('12') && M.phraseImprimeSansNumero({}, '101', '12') === '', '§3 « imprimé sans N° » : dit, avec le N° apparu depuis ; rien si pas imprimé sans N°');

  // §4 la fonction de l'app, EXÉCUTÉE
  let m = /\n  const numeroVenteEmail = \(o, b0\) => \{\n[\s\S]*?\n  \};\n/.exec(app);
  dit(!!m, '§4 `numeroVenteEmail` existe dans l’app');
  if (m) {
    const lancer = ({ saleOv = {}, bordLinks = {}, labelsCaptes = {}, numeros = {}, resolu = null, ecritActif = false, bords = {} } = {}) => {
      // eslint-disable-next-line no-new-func
      const f = new Function('ctx', `const { saleOv, bordLinks, bordKey, labelsCaptes, numeros, resolvedEntry, numeroEcritDansArticle, numeroEmailAdmis, numeroEcritActif, lireNumeroEcrit, numeroReprenable, coupureNumerotation, venteApresCoupure, decisionNumeroVenteEmail, bordsVenteEmailParTx } = ctx;\n${m[0].replace('const numeroVenteEmail =', 'return')}`);
      return f({ saleOv, bordLinks, bordKey: (b) => String((b && (b.transaction || b.suivi || b.numero)) || ''), labelsCaptes, numeros, resolvedEntry: () => resolu,
        numeroEcritDansArticle: M.numeroEcritDansArticle, numeroEmailAdmis: () => true, numeroEcritActif: () => ecritActif,
        lireNumeroEcrit: ({ titre }) => { const x = /N°\s?(\d+)/.exec(titre || ''); return x ? { etat: 'lu', cle: x[1] } : { etat: 'rien' }; },
        numeroReprenable: (n) => n, coupureNumerotation: () => null, venteApresCoupure: () => true, decisionNumeroVenteEmail: M.decisionNumeroVenteEmail, bordsVenteEmailParTx: bords });
    };
    const TITRE = 'Nike Dunk Low panda taille 42';
    // 50 jumelles : même titre, chaque bordereau porte un N° retrouvé par TITRE (absent du titre reçu).
    const jumelles = Array.from({ length: 50 }, (_, i) => ({ o: ve(String(7000 + i), { title: TITRE }), b: bd(String(7000 + i), { article: TITRE, numero: String(i + 1) }) }));
    const numeros = Object.fromEntries(jumelles.map((_, i) => ['9' + i, { numero: String(i + 1), title: TITRE }]));
    const nums = jumelles.map((j) => lancer({ numeros })(j.o, j.b).numero);
    dit(nums.every((n) => n === ''), '§4 50 ventes e-mail au même titre, N° retrouvés par titre ⇒ AUCUN N° tamponné', nums.filter(Boolean).slice(0, 5).join(','));
    const ecrits = jumelles.map((j, i) => lancer({ numeros })(j.o, { ...j.b, article: `${TITRE} n${i + 101}`, numero: String(i + 101) }).numero);
    dit(ecrits.every((n, i) => n === String(i + 101)), '§4 50 jumelles, chacune son « nK » écrit ⇒ chacune SON K', ecrits.slice(0, 5).join(','));
    const j0 = jumelles[0];
    dit(lancer({ saleOv: { 7000: { numero: '44' } } })(j0.o, j0.b).numero === '44', '§4 N° posé à la main sur la transaction ⇒ lui');
    dit(lancer({ saleOv: { 7000: { numero: '44' } } })(j0.o, { ...j0.b, article: TITRE + ' n45', numero: '45' }).numero === '', '§4 N° posé ≠ N° écrit ⇒ aucun (contredit)');
    dit(lancer({ labelsCaptes: { 7000: { item: 'A1' } }, numeros: { A1: { numero: '61' } } })(j0.o, j0.b).numero === '61', '§4 l’annonce de la transaction (identité Vinted captée) ⇒ son N°');
    dit(lancer({ resolu: { numero: '62' } })(j0.o, j0.b).numero === '62', '§4 identité d’annonce (photo exacte) ⇒ son N°');
    dit(lancer({ bordLinks: { 7000: { numero: '63' } } })(j0.o, j0.b).numero === '63', '§4 « Relier » (son clic) ⇒ son N°');
    dit(lancer({ ecritActif: true })({ ...j0.o, title: TITRE + ' N° 64' }, j0.b).numero === '64', '§4 réglage « je numérote moi-même » : le N° du titre de la vente');
    dit(lancer({ ecritActif: false })({ ...j0.o, title: TITRE + ' N° 64' }, j0.b).numero === '', '§4 réglage éteint : le titre de la vente ne donne rien');
    dit(lancer({ bords: { 7000: { ...j0.b, article: TITRE + ' n65', numero: '65' } } })(j0.o, null).numero === '65', '§4 sans bordereau passé : celui de la transaction (même n°)');
  }

  // §5 le câblage
  const corps = (debut, fin) => { const i = app.indexOf(debut); if (i < 0) return ''; const j = app.indexOf(fin, i + debut.length); return app.slice(i, j < 0 ? i + 6000 : j); };
  const expCalc = corps('  const expeditionsCalc = () => {', '\n  };\n');
  dit(/colisVentesEmail\(\{\s*ventesEmail,\s*bordsParTx:\s*parTxn/.test(expCalc) && /items\.push\(\{[^}]*venteEmail:\s*true/.test(expCalc), '§5 Colis (`expeditionsCalc`) ajoute les colis des ventes e-mail par la règle');
  const toShip = corps('  const toShip = useMemo(() => {', '\n  }, [');
  dit(/colisVentesEmail\(/.test(toShip) && /isShipDone\(x\.o\)/.test(toShip), '§5 Ma journée / cloche (`toShip`) comptent les mêmes colis');
  const nfb = corps('  const numForBord = (b) => {', '\n  };\n');
  const iVe = nfb.indexOf('numeroVenteEmail('), iNum = nfb.indexOf('b.numero');
  dit(iVe > 0 && iNum > iVe && /!soldByTxn\[txB\]/.test(nfb), '§5 `numForBord` : une vente e-mail passe par la décision AVANT tout `b.numero`');
  const eff = corps("  const effEntry = memoVersion('effective', (o) => {", '\n  }, () => [');   // (12 nov.) mémoire par version des données
  dit(/o\._venteEmail/.test(eff) && /numeroVenteEmail\(o\)/.test(eff), '§5 `effEntry` : le N° d’une vente e-mail est la décision');
  dit(m && !/\bb\.numero\b/.test(m[0]), '§5 `numeroVenteEmail` ne lit jamais `b.numero` directement');
  dit(/o\._venteEmail && vFilter === 'aexpedier'\) return estColisEmail\(o\)/.test(app), '§5 le filtre « À envoyer » de Ventes montre le même colis');
  dit(/data-fu-imprimer=\{txL\} data-fu-imprimer-num/.test(app) && /toShipEmailTx\.has\(txL\)/.test(app), '§5 la ligne « Vue par e-mail » porte Imprimer');
  const lot = corps('  const lignesLot = () => expeditions()', '\n');
  dit(!!lot, '§5 « Tout imprimer » et « à imprimer » partent de `expeditions()` (la même liste)');
  dit(/texteBordereau\(\{ modele: data\.modele, numero: numeroLu,/.test(serveur), '§5 la notification du bordereau ne nomme que le N° LU (jamais `parTitre`)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return { ko, ok };
}

const MUTATIONS = [
  ['module : le colis sans l’identité du n°', 'm', "if (!b || String(b.transaction) !== tx) continue;", 'if (!b) continue;'],
  ['module : une vente partie reste', 'm', "if (typeof partie === 'function' && partie(o, b)) continue;", ''],
  ['module : la liste Vinted ne gagne plus', 'm', "if (typeof connues === 'function' && connues(tx)) continue;", ''],
  ['module : deux N° contraires ⇒ le premier', 'm', "if (parCle.size > 1) return", "if (parCle.size > 99) return"],
  ['module : tout `numero` compte pour écrit', 'm', "return cleNumero(m[1]) === n ? n : '';", 'return n;'],
  ['module : le N° écrit sans le titre', 'm', "if (!m) return '';", "if (!m) return n;"],
  ['app : le N° du bordereau tel quel', 'a', "const ec = b ? numeroEcritDansArticle(b) : '';", "const ec = b ? String(b.numero || '') : '';"],
  ['app : numForBord sans la décision', 'a', "if (ve) return numeroVenteEmail(ve, b).numero;", ''],
  ['app : Colis sans les ventes e-mail', 'a', "      items.push({ key: 'v' + x.txn, o: x.o, b: x.b, txn: x.txn, venteEmail: true });", ''],
  ['serveur : la notification nomme le N° par titre', 's', 'texteBordereau({ modele: data.modele, numero: numeroLu,', 'texteBordereau({ modele: data.modele, numero: data.numero,'],
];

(async () => {
  const racine = process.argv.find((a) => a.startsWith('--racine='));
  const R = racine ? racine.slice(9) : RACINE;
  const lire = (p) => { try { return fs.readFileSync(path.join(R, p), 'utf8'); } catch (_) { return ''; } };
  const base = { module: lire('src/bordereauVenteEmail.js'), app: sourceApp(R), serveur: lire('api/email-inbound.js') };
  const r = await auditer(base);
  console.log(`audit-bordereau-des-email : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  if (process.argv.includes('--prouve')) {
    let attrapees = 0;
    for (const [nom, cible, de, vers] of MUTATIONS) {
      const k = cible === 'm' ? 'module' : cible === 'a' ? 'app' : 'serveur';
      if (!base[k].includes(de)) { console.log(`MUTATION INTROUVABLE : ${nom}`); continue; }
      const mu = { ...base, [k]: base[k].replace(de, vers) };
      const rr = await auditer(mu);
      if (rr.ko > 0) attrapees++; else console.log(`MUTATION NON ATTRAPÉE : ${nom}`);
    }
    console.log(`--prouve : ${attrapees}/${MUTATIONS.length} mutations attrapées`);
    if (attrapees !== MUTATIONS.length) process.exit(1);
  }
  process.exit(r.ko ? 1 : 0);
})();
