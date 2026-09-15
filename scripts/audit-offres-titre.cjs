// ⚠️⚠️ CONTRÔLE PERMANENT — UNE OFFRE NE SE CACHE PAS SUR UN TITRE.
//
// Mesuré le 15 septembre sur sa vraie base : sur ses **176 offres de moins de
// 14 jours**, l'accueil n'en montrait que **41**. Les 135 autres étaient
// écartées parce qu'une vente — n'importe laquelle, n'importe quand, sur
// n'importe lequel de ses neuf comptes — portait le MÊME TITRE. C'est §5 mot
// pour mot (« 22 % des ventes portent un titre en double, et le titre désignait
// la MAUVAISE annonce dans 3 cas réels »), et l'asymétrie est décisive : montrer
// une offre déjà réglée coûte un clic sur « ✓ », en cacher une vivante lui fait
// **rater une vente**.
//
// ⚠️ CHERCHÉ D'ABORD, UNE IDENTITÉ : `item_id` 0/518, `transaction` 0/518,
//    `conversation` 0/518. Les liens de l'email sont des redirections
//    `links.vinted.com` en base64 qui ne portent que l'identifiant d'invitation,
//    identique dans tous les emails. Aucun pont certain n'existe — on n'échange
//    donc pas une ressemblance contre une autre, on ajoute les contraintes
//    RÉELLES : le compte, la chronologie, et un titre qui ne désigne qu'une paire.
//
// ⚠️ CE CONTRÔLE EXÉCUTE LA VRAIE FONCTION extraite d'`App.jsx` dans un `vm`
//    (comme `audit-fusion.cjs`) : il juge ce qu'elle REND, pas comment elle est
//    écrite. Une reformulation ne peut pas le rendre vert (§6.5).
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// On extrait la règle ET ses deux dépendances, rien d'autre.
const morceau = (re, quoi) => { const m = re.exec(APP); if (!m) { dit(false, `${quoi} introuvable dans App.jsx`); return null; } return m[0]; };
const fnOffres = morceau(/const offresAtraiter = \([\s\S]*?\n\};/, '`offresAtraiter`');
const fnNorm = morceau(/const normTitle = \([^\n]*\n/, '`normTitle`');
const fnClass = morceau(/const classifyOrderStatus = \([\s\S]*?\n\};/, '`classifyOrderStatus`');
// ⚠️ Les BORNES aussi : la règle les lit, et un `vm` n'a pas de portée globale
//    par magie. Les extraire du source plutôt que les recopier ici — recopiées,
//    elles mesureraient MES chiffres, pas ceux de l'app (§6.5).
const fnBornes = (APP.match(/const OFFRE_(?:FENETRE_J|TOLERANCE_H) = [^\n]*\n/g) || []).join('');
dit(/OFFRE_FENETRE_J/.test(fnBornes) && /OFFRE_TOLERANCE_H/.test(fnBornes),
  'les bornes de la règle sont déclarées dans App.jsx', fnBornes ? '' : 'introuvables');

// ⚠️ UN AUDIT NE MEURT PAS, IL RAPPORTE — cinquième récidive dans ce dossier, et
//    je viens de la refaire : mon premier jet chargeait la règle sans ses bornes
//    et sortait en `ReferenceError`, donc AUCUN contrôle n'était rendu.
let regle = null;
if (fnOffres && fnNorm && fnClass && fnBornes) {
  try {
    const ctx = { console: { log() {} } };
    vm.createContext(ctx);
    vm.runInContext(`${fnNorm}\n${fnClass}\n${fnBornes}\n${fnOffres}\nglobalThis.R = offresAtraiter;`, ctx, { filename: 'App.jsx' });
    regle = ctx.R;
  } catch (e) { dit(false, 'la règle se charge', String((e && e.message) || e)); }
}
if (typeof regle !== 'function') {
  dit(false, 'la règle des offres est exécutable', '`offresAtraiter` n\'a pas pu être chargée');
  console.log(`\n${ko} contrôle(s) en échec.`);
  process.exit(1);
}
const cle = (o) => `${o.receivedAt || ''}|${(o.article || '').toLowerCase().trim()}`;

const J = 86400000;
const iso = (dj) => new Date(Date.now() - dj * J).toISOString();
// Une vente telle que l'app la manipule (`_acc` porte le compte).
const vente = (titre, uid, dj, tx) => ({ title: titre, status: 'Transaction finalisée',
  transaction_id: tx, date: iso(dj), _acc: { vinted_user_id: uid } });
const offre = (titre, uid, dj) => ({ article: titre, uid, receivedAt: iso(dj), montant: '30,00' });

console.log('── UNE VENTE QUI NE PEUT PAS AVOIR RÉGLÉ L\'OFFRE NE LA CACHE PAS');
{
  // 1. Le COMPTE. Une offre reçue sur un compte n'est pas réglée par la vente
  //    d'un autre : ce sont deux annonces différentes, chez deux vendeurs.
  const r = regle([offre('nike p-6000 noir taille 39', '111', 1)],
    [vente('nike p-6000 noir taille 39', '222', 0, 'T1')], new Set(), cle);
  dit(r.gardees.length === 1, 'une vente sur un AUTRE compte ne cache pas l\'offre',
    r.gardees.length ? '' : 'l\'offre disparaît de l\'accueil — il ne répond jamais');

  // 2. La CHRONOLOGIE. Une vente ANTÉRIEURE à l'offre ne l'explique pas : il
  //    avait donc une seconde paire, et cette offre-là est vivante.
  const r2 = regle([offre('autry reelwind blanc taille 44', '111', 1)],
    [vente('autry reelwind blanc taille 44', '111', 5, 'T1')], new Set(), cle);
  dit(r2.gardees.length === 1, 'une vente ANTÉRIEURE à l\'offre ne la cache pas',
    r2.gardees.length ? '' : 'vendue 4 jours AVANT que l\'offre n\'arrive');

  // 3. Un titre AMBIGU ne désigne rien (§2.4 : « même avec 50 articles
  //    identiques, tu ne dois pas pouvoir te tromper »). Mesuré chez lui :
  //    « adidas spezial noir taille 35,5 » est porté par CINQ transactions.
  const r3 = regle([offre('adidas spezial noir taille 35,5', '111', 2)],
    [vente('adidas spezial noir taille 35,5', '111', 1, 'T1'),
     vente('adidas spezial noir taille 35,5', '111', 1, 'T2')], new Set(), cle);
  dit(r3.gardees.length === 1, 'un titre porté par DEUX transactions ne cache pas l\'offre',
    r3.gardees.length ? '' : 'vendre une paire cacherait les offres faites à sa jumelle');
}

console.log('\n── ET L\'AUTRE SENS : CE QUI EST VRAIMENT RÉGLÉ SORT BIEN');
// Sans cette moitié, « ne rien cacher jamais » passerait le contrôle — et
// l'accueil afficherait 176 offres dont la plupart sont mortes.
{
  const r = regle([offre('nike p-6000 noir taille 39', '111', 2)],
    [vente('nike p-6000 noir taille 39', '111', 1, 'T1')], new Set(), cle);
  dit(r.gardees.length === 0 && r.reglees.length === 1,
    'même compte, vente APRÈS l\'offre, titre unique → l\'offre est mise de côté',
    `${r.gardees.length} gardée(s), ${r.reglees.length} réglée(s)`);

  const vieille = regle([offre('x', '111', 30)], [], new Set(), cle);
  dit(vieille.gardees.length === 0, 'une offre de plus de 14 jours ne compte plus');

  const faite = regle([offre('y', '111', 1)], [], new Set([cle(offre('y', '111', 1))]), cle);
  dit(faite.gardees.length === 0, 'et une offre marquée « traité » non plus');

  const sansVente = regle([offre('z', '111', 1)], [], new Set(), cle);
  dit(sansVente.gardees.length === 1, 'aucune vente captée ⇒ on ne cache RIEN',
    '« rien lu » ne vaut pas « rien » : une lecture vide ne doit pas vider sa liste');
}

console.log('\n── ET CE QU\'ON MET DE CÔTÉ EST DIT, PAS AVALÉ');
{
  // Une liste qui rétrécit sans explication se lit comme une perte (leçon de
  // l'écran Leboncoin). Le rendu doit citer le nombre écarté.
  const sansCommentaires = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
  const src = sansCommentaires(APP);
  dit(/reglees\.length\s*>\s*0\s*&&/.test(src), 'l\'accueil affiche le nombre mis de côté',
    'sinon la carte passe de 75 à 41 sans un mot');
  dit(/offresAtraiter\(/.test(src), 'et la règle a UN SEUL propriétaire (§11)',
    'recopiée dans le JSX, elle redevient impossible à mesurer');
}

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucune offre n\'est cachée sur une simple ressemblance.');
process.exit(ko ? 1 : 0);
