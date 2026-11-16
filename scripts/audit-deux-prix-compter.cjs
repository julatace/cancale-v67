// ════════════════════════════════════════════════════════════════════════════
// AUDIT « DEUX PRIX PRO COMPTÉS AU PRIX DE L'ARTICLE » (16 nov. au soir, lot deux-prix-compter)
// Données INVENTÉES (aucune vente réelle).
//
// Décision de Julien : sur un compte Vinted Pro, une vente dont le prix de la LISTE dépasse le
// prix de l'ARTICLE de quelques centimes à 2 € (relevé muet) est COMPTÉE au prix de l'article,
// partout ; l'écart (liste − article) est ÉCRIT à côté, jamais ajouté. Rien d'autre ne bouge.
//
// La base : un compte Pro (une vente à un prix, trois à deux prix ≤ 2 €, une à 2,50 € d'écart,
// une dont la liste est SOUS l'article, une dont la transaction n'est pas lue) et un compte
// particulier (deux ventes). Les totaux sont calculés par les VRAIES règles : src/vintedPro.js
// (posée au chargement) puis le miroir serveur api/_lib/ventes-regle.js (= App.jsx, recopié).
//
//  U. Ventes à UN prix : chaque montant inchangé au centime (Pro et particulier).
//  D. Ventes à deux prix ≤ 2 € : comptées au prix de l'ARTICLE (le plus bas), dans le CA déclaré
//     (daté au versement) ET dans le vendu.
//  T. Totaux exacts : ni le prix de la liste, ni l'écart ajouté.
//  A. Écart > 2 €, liste sous l'article, transaction pas lue : toujours à part, NOMMÉES.
//  E. L'écart : par ligne (`ecartC`) et en somme (`ecartNonCompte`) = liste − article.
//  F. La facture Pro de ces ventes : au prix de l'article (preuve « même montant » avec l'e-mail
//     de vente, qui porte le prix de l'article — mesuré : 21/21 e-mails Pro = prix de l'article).
//  B. Branchements : la ligne publiée porte l'écart par mois ; Résumé, Déclarer (carte du mois),
//     Mois bouclé et le rapport du mois l'ÉCRIVENT ; la clé `nc.ecart` existe en 5 langues.
//
// `--prouve` : chaque mutation doit rendre l'audit ROUGE. `DPC_RACINE=<arbre>` : juge un autre arbre
// (la branche de départ doit être ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

const PRO = '111', PART = '222';
const VERS = '2026-10-15T10:00:00Z';
// tx, compte, prix de la LISTE, prix de l'ARTICLE (null = transaction pas lue)
const BASE = [
  ['1001', PRO, '40.00', '40.0'],
  ['1008', PRO, '60.00', '60.0'],
  ['1002', PRO, '50.48', '50.0'],    // écart 0,48
  ['1003', PRO, '3.47', '3.0'],      // écart 0,47
  ['1004', PRO, '21.45', '20.0'],    // écart 1,45
  ['1009', PRO, '22.00', '20.0'],    // écart 2,00 (la borne : compté)
  ['1005', PRO, '33.00', '30.5'],    // écart 2,50 ⇒ à part
  ['1006', PRO, '25.00', '25.6'],    // liste SOUS l'article ⇒ à part
  ['1007', PRO, '18.00', null],      // transaction pas lue ⇒ à part
  ['2001', PART, '35.00', null],
  ['2002', PART, '12.90', null],
];
const UN_PRIX = { 1001: 4000, 1008: 6000, 2001: 3500, 2002: 1290 };
const DEUX_PRIX = { 1002: 5000, 1003: 300, 1004: 2000, 1009: 2000 };
const ECARTS = { 1002: 48, 1003: 47, 1004: 145, 1009: 200 };
const A_PART = ['1005', '1006', '1007'];
const somme = (o) => Object.values(o).reduce((t, x) => t + x, 0);

async function controler(racine) {
  const res = [];
  const ok = (nom, cond, detail = '') => res.push({ nom, ok: !!cond, detail });
  const imp = (f) => import(pathToFileURL(path.join(racine, f)).href + `?t=${Date.now()}${Math.random()}`);
  let V, R, RA, RG;
  try { V = await imp('src/vintedPro.js'); R = await imp('api/_lib/ventes-regle.js'); } catch (e) { ok('modules', false, e.message); return res; }
  try { RA = await imp('src/facturePro/rattachement.js'); RG = await imp('src/facturePro/regle.js'); } catch (e) { ok('modules facture', false, e.message); }

  const commande = ([tx, uid, liste]) => ({ transaction_id: tx, price: { amount: liste, currency_code: 'EUR' }, status: 'Commande finalisée', date: '2026-10-01T10:00:00Z', title: 'Paire inventée', _acc: { vinted_user_id: uid } });
  const pro = BASE.filter((b) => b[1] === PRO), part = BASE.filter((b) => b[1] === PART);
  const txns = new Map(pro.filter((b) => b[3] != null).map(([tx, , , art]) => [tx, { tx, side: 'seller', prix: art, devise: 'EUR' }]));
  // Comme fetchVintedOrders : la règle Pro posée au chargement des ventes d'UN compte.
  const ventes = [...V.appliquerPrixPro(pro.map(commande), { pro: true, txns, releve: null }), ...V.appliquerPrixPro(part.map(commande), { pro: false })];
  const versements = Object.fromEntries(BASE.map(([tx]) => [tx, VERS]));
  const d = R.ventesDeclarables({ vinted: ventes, versements, declare: {} });
  const f = R.ventesFaites({ vinted: ventes });
  const cents = (l) => Math.round(l.eur * 100);
  const parTx = (lignes, cle = (l) => String(l.id || '').replace(/^vinted:/, '') || l.tx) => new Map(lignes.map((l) => [cle(l), l]));
  const lD = parTx(d.lignes), lF = parTx(f.lignes, (l) => l.tx);

  // U
  for (const [tx, c] of Object.entries(UN_PRIX)) {
    ok(`U déclaré : vente à un prix ${tx} inchangée (${c} c)`, lD.get(tx) && cents(lD.get(tx)) === c && !lD.get(tx).ecartC, lD.get(tx) ? String(cents(lD.get(tx))) : 'absente');
    ok(`U vendu : vente à un prix ${tx} inchangée`, lF.get(tx) && cents(lF.get(tx)) === c && !lF.get(tx).ecartC);
  }
  // D
  for (const [tx, c] of Object.entries(DEUX_PRIX)) {
    ok(`D déclaré : ${tx} comptée au prix de l'article (${c} c)`, lD.get(tx) && cents(lD.get(tx)) === c, lD.get(tx) ? String(cents(lD.get(tx))) : 'à part');
    ok(`D vendu : ${tx} au prix de l'article`, lF.get(tx) && cents(lF.get(tx)) === c, lF.get(tx) ? String(cents(lF.get(tx))) : 'absente');
  }
  ok('D déclaré : daté au VERSEMENT (le mois du versement, §5)', Object.keys(DEUX_PRIX).every((tx) => lD.get(tx) && lD.get(tx).ym === '2026-10'));
  // T
  const totalD = d.lignes.reduce((t, l) => t + cents(l), 0);
  const attendu = somme(UN_PRIX) + somme(DEUX_PRIX);
  ok(`T CA déclaré = ventes à un prix + prix de l'article (${attendu} c), ni liste ni écart`, totalD === attendu, `total ${totalD} (avec l'écart : ${attendu + somme(ECARTS)})`);
  const venduD = f.lignes.filter((l) => Object.keys(UN_PRIX).includes(l.tx) || Object.keys(DEUX_PRIX).includes(l.tx)).reduce((t, l) => t + cents(l), 0);
  ok('T vendu (mêmes ventes) = le même total', venduD === attendu, `vendu ${venduD}`);
  // A
  const ec = new Map(d.ecartees.map((x) => [String(x.id).replace(/^vinted:/, ''), x]));
  for (const tx of A_PART) ok(`A ${tx} reste à part, NOMMÉE (manque)`, !lD.has(tx) && ec.get(tx) && ec.get(tx).manque === true);
  ok('A l\'écart > 2 € garde ses deux prix à côté (rien choisi)', ec.get('1005') && ec.get('1005').deux && ec.get('1005').deux.listeC === 3300 && ec.get('1005').deux.artC === 3050);
  // E
  for (const [tx, c] of Object.entries(ECARTS)) ok(`E ${tx} porte son écart (${c} c) à côté`, lD.get(tx) && lD.get(tx).ecartC === c && lF.get(tx) && lF.get(tx).ecartC === c);
  const se = typeof V.ecartNonCompte === 'function' ? V.ecartNonCompte(d.lignes) : null;
  ok(`E somme de l'écart = ${somme(ECARTS)} c sur ${Object.keys(ECARTS).length} ventes`, se && se.c === somme(ECARTS) && se.n === Object.keys(ECARTS).length, se ? JSON.stringify(se) : 'ecartNonCompte absente');
  ok('E l\'écart d\'un mois sans ces ventes = 0', se && V.ecartNonCompte(d.lignes, (l) => l.ym === '2026-09').n === 0);

  // F — la facture produite
  if (RA && RG) {
    const cmd = ventes.find((o) => String(o.transaction_id) === '1002');
    const mail = { transaction: '1002', receivedAt: '2026-10-01T10:01:00Z', prix: '50.00', email: 'acheteur@exemple.test', nom: 'Acheteur Inventé', adresse: '1 rue Inventée\n35000 Rennes', uid: PRO, designation: 'Paire inventée', pro: true };
    const p = RA.preuveAcheteur({ tx: '1002', mails: [mail], commandes: [{ transaction_id: '1002', date: cmd.date, price: cmd.price, uid: PRO, title: cmd.title }] });
    ok('F la vente se prouve avec l\'e-mail (même montant = prix de l\'article)', p && p.prouve === true && p.centimes === 5000, p && p.raison ? p.raison : '');
    if (p && p.prouve) {
      const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
      const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
      const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
      const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA' };
      const c = RG.contenuFacture(CFG, { acheteur: p.acheteur, designation: p.designation, centimes: p.centimes, venteLe: p.venteLe, reference: '1002', plateforme: 'Vinted' }, { numero: 'FA-2026-0001', emiseLe: Date.parse('2026-10-02T10:00:00Z') });
      const tot = RG.totalDocument(c);
      ok('F la facture produite : total = prix de l\'article (50,00 €)', c.totaux.ttc === 5000 && tot && /50,00/.test(String(tot[1])), tot ? String(tot[1]) : '');
    }
  }

  // B — branchements (code sans commentaires)
  const lire = (fi) => { try { return fs.readFileSync(path.join(racine, fi), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, ''); } catch (_) { return ''; } };
  const app = lire('src/App.jsx'), compta = lire('src/ecrans/Compta.jsx'), mb = lire('src/MoisBoucle.jsx'), fp = lire('src/FacturePro.jsx');
  ok('B publication : l\'écart par mois dans vinted_urssaf_mois (ecartNonCompte, nEcart/ecartC hors `ca`)', /ecartNonCompte\(lignes, \(l\) => l\.ym === m\.ym\)/.test(app) && /\{ nEcart: ec\.n, ecartC: ec\.c \}/.test(app));
  ok('B rapport du mois : l\'écart du mois écrit sous le CA', /ecartNonCompte\(declRapport\.lignes, \(l\) => l\.ym === reportMonth\)/.test(app) && /report\.nEcart \? ' · ' \+ tr\('nc\.ecart'/.test(app));
  ok('B Résumé (Vendu et reçu) : l\'écart écrit', /ecart: ecartNonCompte\(\[\.\.\.decl\.lignes, \.\.\.decl\.aDater\]\)/.test(compta) && /\{calc\.ecart\.n > 0 && <div data-ca-ecart-pro=\{calc\.ecart\.c\}[^>]*>\{tr\('nc\.ecart'/.test(compta));
  ok('B Déclarer (carte du mois) : l\'écart écrit', /data-urssaf-ecart-pro=\{e\.ecartC\}/.test(compta) && /tr\('nc\.ecart', \{ n: Number\(e\.nEcart\)/.test(compta));
  ok('B Mois bouclé : l\'écart écrit', /data-mb-ecart-pro=\{m\.ecartC\}/.test(mb));
  ok('B la facture lit les ventes de la coque (prix Pro posé au chargement)', /commandesDeCoque\(ventes\)/.test(fp) && /type === 'sold' \? await appliquerPrixProCompte/.test(app));
  for (const L of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${L}/argentMieux.js`);
    ok(`B traduction ${L} : nc.ecart (un/plusieurs, {x} et {n})`, /"nc\.ecart": \{\s*"one": "[^"]*\{x\}[^"]*\{n\}[^"]*",\s*"other": "[^"]*\{x\}[^"]*\{n\}/.test(t));
  }
  return res;
}

const MUTATIONS = [
  ['src/vintedPro.js', "if (cr == null && liste > art && liste - art <= ECART_MAX_C) {", "if (false) {", 'deux prix ≤ 2 € laissées à part (règle d\'avant)'],
  ['src/vintedPro.js', "n.price = { amount: (r.prixArticle / 100).toFixed(2), currency_code: 'EUR' };", "", 'comptées au prix HAUT (la liste)'],
  ['api/_lib/ventes-regle.js', "const l = { id, plateforme: 'Vinted', ts: t, ym: ymDeTs(t), eur, titre", "const l = { id, plateforme: 'Vinted', ts: t, ym: ymDeTs(t), eur: ecartPro ? eur + ecartPro.ecartC / 100 : eur, titre", 'écart AJOUTÉ au CA'],
  ['src/vintedPro.js', "liste - art <= ECART_MAX_C", "liste - art <= 1000", 'écart > 2 € compté'],
  ['src/vintedPro.js', "if (cr == null && liste > art &&", "if (cr == null && liste !== art &&", 'liste sous l\'article comptée'],
  ['src/vintedPro.js', "n += 1; c += l.ecartC;", "n += 1;", 'écart pas sommé'],
  ['src/ecrans/Compta.jsx', "{calc.ecart.n > 0 && <div data-ca-ecart-pro", "{false && <div data-ca-ecart-pro", 'Résumé muet'],
];

function copierArbre(dst) {
  // Tout `src/` et `api/_lib/` (leurs imports se suivent loin) + package.json (« type »).
  for (const d of ['src', 'api/_lib']) fs.cpSync(path.join(RACINE, d), path.join(dst, d), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dst, 'package.json'));
}

(async () => {
  const racine = process.env.DPC_RACINE || RACINE;
  const res = await controler(racine);
  for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.nom}${r.detail ? ' — ' + r.detail : ''}`);
  const rouges = res.filter((r) => !r.ok).length;
  console.log(`\n${res.length - rouges} vert(s), ${rouges} rouge(s)`);
  if (process.argv.includes('--prouve')) {
    let tuees = 0;
    for (const [f, avant, apres, nom] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dpc-'));
      copierArbre(tmp);
      const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(avant)) { console.log(`⚠️ mutation « ${nom} » : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
      fs.writeFileSync(p, s.replace(avant, apres));
      const r = await controler(tmp);
      const rouge = r.some((x) => !x.ok);
      if (rouge) tuees += 1;
      console.log(`${rouge ? "✅ rouge" : "❌ RESTE VERT"} — mutation : ${nom} (${r.filter((x) => !x.ok).length} rouge(s) : ${r.filter((x) => !x.ok).slice(0, 2).map((x) => x.nom + (x.detail ? " [" + String(x.detail).slice(0, 120) + "]" : "")).join(" ; ")})`);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\nmutations : ${tuees}/${MUTATIONS.length} rouges`);
    if (tuees !== MUTATIONS.length) process.exitCode = 1;
  }
  if (rouges) process.exitCode = 1;
})();
