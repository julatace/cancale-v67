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
// ⚠️⚠️ SIXIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER — et les deux
//    dernières dans ce fichier même. Charger la règle dans un `vm` ne suffit
//    pas : l'APPELER peut lever (une dépendance absente du contexte, une forme
//    inattendue), et un rejet non traité tue le processus AVANT le bilan. Tout
//    appel à la règle passe donc par ici : ce qui lève devient un contrôle
//    ROUGE, pas un silence. *Un audit ne meurt pas, il rapporte.*
const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };

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
  const r = essaie('la règle s\'exécute', () => regle([offre('nike p-6000 noir taille 39', '111', 1)],
    [vente('nike p-6000 noir taille 39', '222', 0, 'T1')], new Set(), cle)) || { gardees: [], reglees: [] };
  dit(r.gardees.length === 1, 'une vente sur un AUTRE compte ne cache pas l\'offre',
    r.gardees.length ? '' : 'l\'offre disparaît de l\'accueil — il ne répond jamais');

  // 2. La CHRONOLOGIE. Une vente ANTÉRIEURE à l'offre ne l'explique pas : il
  //    avait donc une seconde paire, et cette offre-là est vivante.
  const r2 = essaie('la règle s\'exécute', () => regle([offre('autry reelwind blanc taille 44', '111', 1)],
    [vente('autry reelwind blanc taille 44', '111', 5, 'T1')], new Set(), cle)) || { gardees: [], reglees: [] };
  dit(r2.gardees.length === 1, 'une vente ANTÉRIEURE à l\'offre ne la cache pas',
    r2.gardees.length ? '' : 'vendue 4 jours AVANT que l\'offre n\'arrive');

  // 3. Un titre AMBIGU ne désigne rien (§2.4 : « même avec 50 articles
  //    identiques, tu ne dois pas pouvoir te tromper »). Mesuré chez lui :
  //    « adidas spezial noir taille 35,5 » est porté par CINQ transactions.
  const r3 = essaie('la règle s\'exécute', () => regle([offre('adidas spezial noir taille 35,5', '111', 2)],
    [vente('adidas spezial noir taille 35,5', '111', 1, 'T1'),
     vente('adidas spezial noir taille 35,5', '111', 1, 'T2')], new Set(), cle)) || { gardees: [], reglees: [] };
  dit(r3.gardees.length === 1, 'un titre porté par DEUX transactions ne cache pas l\'offre',
    r3.gardees.length ? '' : 'vendre une paire cacherait les offres faites à sa jumelle');
}

console.log('\n── ET L\'AUTRE SENS : CE QUI EST VRAIMENT RÉGLÉ SORT BIEN');
// Sans cette moitié, « ne rien cacher jamais » passerait le contrôle — et
// l'accueil afficherait 176 offres dont la plupart sont mortes.
{
  const r = essaie('la règle s\'exécute', () => regle([offre('nike p-6000 noir taille 39', '111', 2)],
    [vente('nike p-6000 noir taille 39', '111', 1, 'T1')], new Set(), cle)) || { gardees: [], reglees: [] };
  dit(r.gardees.length === 0 && r.reglees.length === 1,
    'même compte, vente APRÈS l\'offre, titre unique → l\'offre est mise de côté',
    `${r.gardees.length} gardée(s), ${r.reglees.length} réglée(s)`);

  const vieille = essaie('la règle s\'exécute', () => regle([offre('x', '111', 30)], [], new Set(), cle)) || { gardees: [], reglees: [] };
  dit(vieille.gardees.length === 0, 'une offre de plus de 14 jours ne compte plus');

  const faite = essaie('la règle s\'exécute', () => regle([offre('y', '111', 1)], [], new Set([cle(offre('y', '111', 1))]), cle)) || { gardees: [], reglees: [] };
  dit(faite.gardees.length === 0, 'et une offre marquée « traité » non plus');

  const sansVente = essaie('la règle s\'exécute', () => regle([offre('z', '111', 1)], [], new Set(), cle)) || { gardees: [], reglees: [] };
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

console.log('\n── ET « PAS ENCORE SYNCHRONISÉE » SE JUGE SUR LA TRANSACTION, PAS LE TITRE');
{
  // Même défaut, à côté sur le même écran : le rapprochement se faisait par
  // TITRE alors que les DEUX côtés portent un n° de transaction. Mesuré :
  // 165 des 166 bordereaux le portent, et les 385 ventes aussi.
  const fnBord = /const bordereauxPasSynchro = \([\s\S]*?\n\};/.exec(APP);
  dit(!!fnBord, 'la règle existe et a un seul propriétaire (§11)',
    fnBord ? '' : '`bordereauxPasSynchro` introuvable — recopiée dans le JSX, elle redevient impossible à mesurer');
  if (fnBord) {
    let R2 = null;
    try {
      const c2 = { console: { log() {} } }; vm.createContext(c2);
      vm.runInContext(`${fnBord[0]}\nglobalThis.B = bordereauxPasSynchro;`, c2, { filename: 'App.jsx' });
      R2 = c2.B;
    } catch (e) { dit(false, 'la règle se charge', String((e && e.message) || e)); }
    if (typeof R2 === 'function') {
      // 1. Le cas MESURÉ chez lui : un colis à DEUX paires, titre composé qui ne
      //    correspond à aucun titre de vente — mais sa transaction, elle, est là.
      const deux = { transaction: '22155558568', modele: 'salomon XT-6 gris taille 42, salomon XT-6 bleu taille 42' };
      const r = essaie('la règle des bordereaux s\'exécute', () => R2([deux], [{ transaction_id: '22155558568', title: 'salomon XT-6 gris taille 42' }])) || [];
      dit(r.length === 0, 'un bordereau dont la TRANSACTION est vendue ne sort pas en « pas synchronisée »',
        r.length ? 'fausse alerte sur l\'accueil — et une fausse alerte fait cesser de lire les vraies' : '');

      // 2. L'autre sens : une vraie vente non synchronisée doit sortir, MÊME si
      //    une paire au même titre a été vendue (22 % de titres en double).
      const r2 = essaie('la règle des bordereaux s\'exécute (2)', () => R2([{ transaction: 'T-NEUF', modele: 'nike p-6000 noir taille 39' }],
        [{ transaction_id: 'T-AUTRE', title: 'nike p-6000 noir taille 39' }])) || [];
      dit(r2.length === 1, 'et une vente vraiment absente sort, même si son TITRE est déjà vendu',
        r2.length ? '' : 'le titre la cacherait : c\'est le rapprochement par ressemblance (§5)');

      // 3. Sans identité, on ne dit rien (mieux vaut un blanc qu'un faux).
      const r3 = essaie('la règle des bordereaux s\'exécute (3)', () => R2([{ modele: 'sans transaction' }], [])) || [];
      dit(r3.length === 0, 'un bordereau sans n° de transaction n\'est pas jugé',
        'sans identité il n\'y a rien à affirmer');
    } else {
      dit(false, 'la règle des bordereaux est exécutable');
    }
  }
  // ⚠️ ET LA LIGNE MORTE QUI PRÉPARAIT UN RETOUR DU TITRE : `vendus.add('t:'…)`
  //    alimentait un ensemble que PLUS RIEN ne lisait (le test par titre avait
  //    été retiré, sa ligne d'alimentation était restée). Même famille que le
  //    tiroir `Nav` : un relecteur la « rebranche » un jour en croyant réparer.
  const sansC = APP
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
  dit(!/vendus\.add\('t:'/.test(sansC), 'et aucun ensemble « vendu » n\'est alimenté par un titre',
    'du code mort qui n\'attend qu\'un relecteur pour redevenir un rapprochement par ressemblance');
}

// ⚠️⚠️ `lireVentesProuvees` est ASYNC — et mon premier jet ne l'attendait pas.
//    `r.vendus` valait `undefined` sur une Promise, donc « rien n'est vendu » :
//    les contrôles qui attendent une ABSENCE passaient **pour la mauvaise
//    raison**, et seuls ceux qui attendent une présence tombaient. Un contrôle
//    vert par accident est exactement ce que ce dossier appelle « pire
//    qu'absent ». Ce bloc est donc `await`é.
(async () => {
console.log('\n── ET « CITÉE DANS UNE TRANSACTION » N\'EST PAS « VENDUE »');
{
  // ⚠️⚠️ MESURÉ LE 15 SEPTEMBRE, EN VÉRIFIANT LA FORME (§6) : sur les **711
  //    lignes** de `harvest_*_txn_*`, **468 portent un `status_title` VIDE** —
  //    ce sont des CONVERSATIONS, pas des ventes. Une seule annonce en portait
  //    treize (« salomon XT-6 blanc taille 40 », toujours en ligne) : treize
  //    acheteurs lui ont écrit, aucun n'a acheté.
  //    Conséquence : sur ses 65 annonces en ligne, la « preuve » en écartait
  //    **15** des files Leboncoin et eBay — quinze paires qu'il a encore.
  //    Avec un vrai état de commande : **zéro**. (Sur les 412 annonces FERMÉES
  //    la preuve tenait — 188 états de vente — et c'est ce qui l'a rendue
  //    invisible.)
  const EXT = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
  const fn = /async function lireVentesProuvees\(\)[\s\S]*?\n\}/.exec(EXT);
  dit(!!fn, 'l\'extension a sa règle de preuve', fn ? '' : '`lireVentesProuvees` introuvable');
  if (fn) {
    // La lecture doit RAPPORTER l'état de la commande : sans lui, impossible de
    // distinguer une conversation d'une vente.
    dit(/status_title/.test(fn[0]), 'et elle lit l\'ÉTAT de la commande, pas seulement l\'identité',
      'sans `status_title`, une conversation compte comme une vente');
    // Et elle doit l'utiliser : un état vide, ou un état qui fait REVENIR la
    // paire, ne prouve rien.
    const R3 = (() => {
      try {
        const c = { console: { log() {} } }; vm.createContext(c);
        // On sert des lignes en mémoire : la règle est jugée sur ce qu'elle REND.
        vm.runInContext(`
          const RANGS = __RANGS__;
          async function sbGetTout(){ return RANGS; }
          ${fn[0]}
          globalThis.P = lireVentesProuvees;
          ${/const PAS_UNE_VENTE = [^\n]*/.exec(EXT)[0]}
        `.replace('__RANGS__', JSON.stringify([
          { it: '111', ti: '' },                                      // conversation
          { it: '222', ti: 'Commande finalisée' },                    // vendue
          { it: '333', ti: 'Commande annulée - article indisponible' },// revient
          { it: '444', ti: 'Retour initié' },                         // revient
          { it: '555', ti: 'Un état que je ne connais pas encore' },  // vendue (par défaut)
        ])), c, { filename: 'background.js' });
        return c.P;
      } catch (e) { dit(false, 'la règle de preuve se charge', String((e && e.message) || e)); return null; }
    })();
    if (typeof R3 === 'function') {
      let r = null;
      try { r = await R3(); } catch (e) { dit(false, 'la règle de preuve s\'exécute', String((e && e.message) || e)); }
      const v = (r && r.vendus) || new Set();
      // ⚠️ `instanceof Set` est FAUX ici : le `vm` a son propre Set. On teste ce
      //    qui compte — l'objet sait répondre `has` — pas sa lignée.
      dit(!!r && !!r.vendus && typeof r.vendus.has === 'function',
        'et elle rend bien un ensemble d\'identités',
        'sans `await`, on juge une Promise — et tout paraît « pas vendu »');
      dit(!v.has('111'), 'une CONVERSATION (état vide) ne prouve aucune vente',
        'c\'est ce qui écartait 15 paires qu\'il a encore');
      dit(v.has('222'), 'une commande finalisée, oui');
      dit(!v.has('333') && !v.has('444'), 'une commande annulée ou un retour, non — la paire revient');
      // ⚠️ L'AUTRE SENS, et il compte : un état INCONNU doit valoir « vendue ».
      //    Lister des codes ferait réapparaître une paire vendue dans la file le
      //    jour où Vinted en ajoute un — le défaut que cette preuve corrigeait.
      dit(v.has('555'), 'et un état inconnu compte comme une VENTE',
        'lister des codes ferait reproposer une paire vendue le jour où Vinted en ajoute un');
    } else {
      dit(false, 'la règle de preuve est exécutable');
    }
  }
  // Et l'app applique la MÊME (§11) : deux copies qui divergent donnent deux files.
  dit(/const PAS_UNE_VENTE = /.test(APP) && /const PAS_UNE_VENTE = /.test(EXT),
    'et l\'app et l\'extension portent la même règle',
    'une seule des deux corrigée, et les deux écrans annoncent deux nombres');
}

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucune offre, aucun bordereau n\'est rangé sur une simple ressemblance.');
process.exit(ko ? 1 : 0);
})();
