// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DU RETRAIT D'UN COLIS   —   node scripts/audit-retrait.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour les achats, retirer les colis ce n'est pas encore incroyable ».
// MESURÉ SUR LA VRAIE BASE le 6 septembre 2026, avant de toucher au code :
//   • 139 emails de suivi. 20 portent un code de retrait, 28 un lien de QR,
//     128 un n° de suivi — et **0 le titre de l'article**. Un transporteur ne
//     sait pas ce qu'il y a dans le carton : son email ne peut donc JAMAIS
//     désigner une paire.
//   • 638 emails « non reconnus » : **0** parle de colis. Rien n'est laissé de
//     côté côté email — il n'y a pas de gisement à exploiter là.
//   • une commande d'achat Vinted porte `transaction_id`, `conversation_id`,
//     date, titre, prix, statut — et **aucun n° de suivi**. Le détail de
//     transaction n'en porte pas non plus (191 objets `shipment` : id, status,
//     status_title, status_updated_at, rien d'autre).
//   ⇒ IL N'EXISTE AUCUNE IDENTITÉ COMMUNE entre l'email du transporteur et la
//     commande Vinted. Les relier par la date, le relais ou le titre serait
//     exactement le rapprochement par ressemblance que Julien interdit (§24) —
//     et se tromper ici, c'est ne pas aller chercher un colis, donc le perdre.
//   • `panel_colis_relais` (là où l'extension dépose le code lu dans la
//     conversation) était **VIDE : 0 colis**. D'où l'écran vu en capture :
//     treize lignes « en attente de leur code », et rien à toucher.
//
// Ce que ce fichier protège :
//   1. la porte vers le code existe TOUJOURS — la conversation de la commande
//      (`conversation_id`, une identité donnée par Vinted) ;
//   2. les colis « non réclamés » ne disparaissent plus en silence ;
//   3. on ne fabrique aucun lien par ressemblance ;
//   4. le retrait constaté par un email (n° de suivi identique) continue de
//      sortir le colis de la liste.
//
// ⚠️ Contrôle STATIQUE. Le rendu se vérifie au banc (`retrait.cjs`).
// Lecture seule.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
const BG = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/background.js'), 'utf8');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── 1. LA PORTE VERS LE CODE DE RETRAIT ────────────────────────────────────
dit(/const lienConv\s*=/.test(APP), 'la conversation d\'une commande a un lien',
  /const lienConv/.test(APP) ? '' : 'sans lui, une ligne « en attente de leur code » n\'offre rien à toucher');
const i = APP.indexOf('const lienConv');
const F = i < 0 ? '' : APP.slice(i, i + 220);
dit(/conversation_id/.test(F), 'il est bâti sur `conversation_id` — une identité, pas un titre');
dit(!/title|titre|date/.test(F), 'il ne se déduit d\'aucune ressemblance');

// La ligne d'un colis à retirer doit retomber sur ce lien quand l'extension
// n'a encore rien lu.
dit(/\|\|\s*lienConv\(o\)/.test(APP), 'chaque colis à retirer propose sa conversation',
  /lienConv\(o\)/.test(APP) ? '' : 'la ligne restait muette tant que `panel_colis_relais` était vide');

// ── 2. LES COLIS REPARTIS CHEZ LE VENDEUR ──────────────────────────────────
// ⚠️ Le contrôle porte sur le FILTRE, pas sur les mots : « non réclamé »
// pouvait apparaître ailleurs dans un commentaire et faire passer l'audit sur
// le code d'avant (vu en montant la preuve).
const j = APP.search(/const rendus\s*=/);
const B = j < 0 ? '' : APP.slice(j, j + 3200);
dit(/non r\[ée\]clam\/i\.test\(o\.status/.test(B),
  'les commandes « non réclamées » sont repérées sur le statut Vinted',
  'mesuré : 3 achats, 84,94 €, qui ne sortaient sur AUCUN onglet');
dit(/buysBase/.test(B), 'elles sont lues sur la liste d\'achats, pas recalculées ailleurs');
dit(/à vérifier|a v[ée]rifier/i.test(B), 'le montant est annoncé « à vérifier »');
// ⚠️ Vinted rembourse souvent tout seul : annoncer une PERTE serait un chiffre
// qu'il ne peut pas vérifier (§2.7).
dit(!/perdu|perte/i.test(B), 'on n\'annonce jamais une perte qu\'on ne sait pas prouver');
dit(/lienConv\(o\)/.test(B), 'chaque ligne ouvre sa conversation — là où ça se règle');

// ── 3. AUCUN CODE, AUCUN QR NE RESTE CACHÉ ─────────────────────────────────
// Julien : « il n'y a pas tous les codes de retrait ». Mesuré : sur les
// 6 colis rangés dans « jamais retirés », **3 portent un code et 3 un QR** —
// et ce bloc n'affichait QUE le code. Le QR, seul moyen d'ouvrir un casier
// Pickup, ne s'affichait alors NULLE PART dans l'app.
{
  const i = APP.indexOf('colis jamais retirés');
  const B = i < 0 ? '' : APP.slice(i, i + 4200);
  dit(B.length > 200, 'le bloc des colis jamais retirés existe');
  dit(/qrVivant\(t\)/.test(B), 'il affiche le QR quand il y en a un',
    'sans ça, 3 QR valides ne s\'affichaient nulle part');
  dit(/codeRetrait\(t\.code\)/.test(B), 'et le code de retrait');
  // ⚠️ « Réclame à Vinted » est le mauvais geste quand on a encore le code.
  dit(/leur code ou leur QR|son code ou son QR/.test(B),
    'il distingue ceux qu\'on peut encore aller chercher',
    'au lieu d\'envoyer tout le monde en réclamation');
}
// ⚠️ NEUF COMPTES. Mesuré le 7 septembre : ses 5 colis à retirer sont TOUS sur
// `julatace3535`, dont les conversations n'avaient jamais été captées — parce
// que l'extension lit une conversation quand on l'OUVRE, et qu'il faut être
// connecté sur le bon compte. Sans le nom du compte, le lien ne sert à rien.
dit(/compte <b[^>]*>\{accName\(o\._acc\)\}/.test(APP),
  'chaque colis à retirer dit sur quel compte se connecter',
  'il en a neuf, et l\'extension ne lit que le compte connecté dans l\'onglet');
// ⚠️ SUIVRE LA RÈGLE, PAS SON ORTHOGRAPHE (leçon payée sur `audit-identite`).
// La règle : le lien dit ce qu'il RAPPORTE, pas seulement où il mène.
dit(/Ouvrir la conversation → le code [^'"]+/.test(APP),
  'et ce que ça rapporte d\'ouvrir la conversation',
  'ouvrir un lien sans savoir pourquoi, c\'est du travail en plus');

// ── 3 bis. L'APP NE DOIT PAS RÉCLAMER UN TRAVAIL QUE L'EXTENSION FAIT ──────
// Mesuré dans `background.js` : `capterRetraits(uid)` tourne à CHAQUE visite
// sur Vinted, va chercher la conversation de chaque achat « déposé en point
// relais » et en lit le code — 3 par visite, pas de nouvel essai avant 6 h,
// uniquement pour le compte connecté dans l'onglet (`garde`).
// L'app disait pourtant encore « ouvre la conversation UNE fois » : elle lui
// demandait le travail que l'extension fait toute seule, et quand rien
// n'arrivait il en concluait que l'app était cassée (« ça ne travaille pas
// tout seul »). Ces deux contrôles empêchent le message de re-diverger.
dit(/capterRetraits\(uid\)/.test(BG) && /async function capterRetraits/.test(BG),
  'l\'extension va chercher les codes toute seule, à chaque visite',
  'sinon la phrase de l\'app ci-dessous serait un mensonge');
dit(!/Ouvre la conversation UNE fois/.test(APP),
  'et l\'app ne réclame plus d\'ouvrir chaque conversation',
  'c\'est le geste d\'avant le 27 août');
dit(/l'extension va chercher/i.test(APP) || /va chercher les codes toute seule/i.test(APP),
  'elle dit ce qui se passe tout seul, et à quelle condition',
  'le compte connecté dans l\'onglet — il en a neuf');

// La porte vers la mise à jour de l'extension vit sur l'écran où il constate
// que les codes manquent — pas seulement sur Ma journée.
{
  const i = APP.indexOf("curSub==='achats' && (<>");
  const B = i < 0 ? '' : APP.slice(i, i + 1800);
  dit(/<ExtEnRetard/.test(B), 'l\'écran Achats dit pourquoi les codes manquent',
    'c\'est l\'extension qui les lit dans les conversations');
}

// ── 4. CE QUI ÉTAIT DÉJÀ JUSTE ET DOIT LE RESTER ───────────────────────────
dit(/const suivisRetires/.test(APP) && /status === 'delivered'/.test(APP),
  'un email « colis retiré » sort le colis de la liste (n° de suivi = identité)');
dit(/colisRetireAilleurs/.test(APP), 'et il le sort AUSSI de la ligne du second transporteur');

// ── 7. NE JAMAIS PROMETTRE CE QUE SON EXTENSION NE SAIT PAS FAIRE ─────────
// Mesuré le 8 septembre sur la vraie base : sur les 42 compteurs que
// l'extension tient (`panel_diag_capture.n`), AUCUN `retrait_*` ni `releve_*`
// — alors que `bordereau_genere`, `label_envoye` et tous les `ecrit_*`
// tournaient à la minute sur sept comptes. `capterRetraits` écrit son compteur
// dès qu'il s'exécute, MÊME EN ÉCHEC (`retrait_conv_refuse_*`,
// `retrait_conv_sans_message`). Zéro compteur = la fonction n'a jamais tourné :
// l'extension installée est antérieure a 5.52.
// ⇒ « Passe sur Vinted, l'extension ira chercher les codes » etait donc une
// promesse que SON extension ne peut pas tenir — et on l'envoyait ouvrir Vinted
// pour rien. C'est le défaut le plus coûteux du projet (l'app promet ce que
// l'extension ne fait pas), refait. Le premier geste est la mise à jour.
dit(/const EXT_LIT_LES_CODES\s*=/.test(APP),
  "l'app sait à partir de quelle version l'extension lit les codes",
  'sinon elle promet la fonction de la DERNIÈRE version, pas de celle installée');
dit(/extSaitLireCodes/.test(APP),
  "et elle distingue « absente » / « en retard » / « à jour »");
// La promesse et le repli doivent coexister : jamais la promesse toute seule.
{
  const promesses = (APP.match(/extension va chercher (?:le|les) codes? toute seule/g) || []).length;
  const gardes    = (APP.match(/extSaitLireCodes\(\)/g) || []).length;
  dit(gardes >= promesses,
    'chaque promesse « toute seule » est gardée par une vérification de version',
    `${promesses} promesse(s) · ${gardes} garde(s)`);
}
dit(/ne sait pas encore lire les codes|ne sait pas encore aller lire les codes|mets ton extension à jour/i.test(APP),
  "et une extension en retard s'entend dire de se mettre à jour d'abord",
  "l'envoyer sur Vinted ne donnerait rien");

// ── 8. UNE CAPACITÉ NON PROUVÉE N'EST PAS UNE CAPACITÉ ────────────────────
// Le pont n'annonce sa version que DEPUIS la 5.26 (17 août). Une extension
// plus ancienne est détectée mais MUETTE — et c'est la plus en retard de
// toutes. Or `extEnRetard` exigeait `!!v` : elle ne déclenchait donc AUCUN
// bandeau, et le premier jet de `extSaitLireCodes` répondait « inconnue »,
// qui retombait sur la promesse. Miroir exact de la leçon du panneau de
// sécurité : « pas su » ne vaut pas « oui ».
dit(!/if \(!v\) return 'inconnue'/.test(APP),
  "une extension muette sur sa version ne passe plus pour capable",
  "se taire veut dire « plus vieille que 5.26 »");
dit(/const muette = ext\.on && !ext\.v/.test(APP),
  "et le bandeau de retard s'affiche aussi pour elle",
  "c'etait la seule a ne rien declencher");

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nUn colis à retirer offre toujours une porte, et aucun ne repart en silence.');
process.exit(ko ? 1 : 0);
