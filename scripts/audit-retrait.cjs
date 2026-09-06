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

// ── 3. CE QUI ÉTAIT DÉJÀ JUSTE ET DOIT LE RESTER ───────────────────────────
dit(/const suivisRetires/.test(APP) && /status === 'delivered'/.test(APP),
  'un email « colis retiré » sort le colis de la liste (n° de suivi = identité)');
dit(/colisRetireAilleurs/.test(APP), 'et il le sort AUSSI de la ligne du second transporteur');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nUn colis à retirer offre toujours une porte, et aucun ne repart en silence.');
process.exit(ko ? 1 : 0);
