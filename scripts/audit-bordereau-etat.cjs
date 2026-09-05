#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// LE DÉTAIL D'EXPÉDITION NE PARLE PAS LA LANGUE DE LA COMMANDE.
//
// Plainte de Julien (1er sept.) : « j'ai généré manuellement le bordereau et
// l'extension m'a mis encore que c'était en paiement validé et non en génération
// de bordereau. Et quand j'ai actualisé, la vente s'est automatiquement
// supprimée et ça n'a pas marqué que le bordereau a été généré. »
//
// Trois défauts, tous mesurés sur la vraie base avant correction :
//   A. le LIBELLÉ (`aGenerer`/`emis`) lisait la commande pendant que le FILTRE
//      lisait la capture la plus fraîche → deux sources pour la même question
//      sur la même ligne (§11) ;
//   B. `awaitingShip` est une liste POSITIVE de deux phrases, appliquée au
//      vocabulaire de l'EXPÉDITION : « Commande du bordereau d'envoi validée »
//      — le statut qui apparaît JUSTE APRÈS une génération manuelle — n'y
//      figure pas, donc la vente DISPARAISSAIT (§5.17, même leçon côté app) ;
//   C. `shipment: {}` + `status_title: ""` fait retomber la chaîne de replis sur
//      `t.status`, le NOMBRE 1 — un code traité comme un libellé. 284 lignes en
//      base portent ce piège.
//
// Les libellés ci-dessous sont ceux RELEVÉS EN BASE, pas des inventions.
// ────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const BG = R('vinted-sync-extension/background.js');
let ko = 0;
const ok  = m => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// ── on EXÉCUTE la vraie fonction, on ne relit pas son texte ──────────────────
const src = (BG.match(/const etatExpedition = \(st\) => \{[\s\S]*?\n\};/) || [])[0];
// ⚠️ Sans `etatExpedition`, on ne s'ARRÊTE PAS : on rejoue la sémantique
// d'AVANT (le détail était passé tel quel à `awaitingShip`, et « faux » voulait
// dire « le colis est parti »). Les contrôles ci-dessous s'exécutent alors sur
// l'ancien code et montrent, statut réel par statut réel, ce qu'il cassait —
// un audit qui sort au premier manque ne prouve qu'une chose (§21).
let etat;
if (src) {
  const ctx = { module: {}, exports: {} };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.f = etatExpedition;', ctx);
  etat = ctx.f;
} else {
  ko++; console.log("❌ etatExpedition absente — on rejoue l'ancienne règle pour montrer ce qu'elle cassait");
  const awOld = new Function('s', 'return ' + (BG.match(/const awaitingShip = \((s)\) => ([^\n]*?);\n/) || [])[2] + ';');
  etat = (st) => (awOld(st) ? 'attend' : 'parti');
}

// Statuts d'EXPÉDITION réellement présents en base (harvest_*_txn_*)
const ATTEND = [
  "Commande du bordereau d'envoi validée",   // ⚠️ juste après une génération manuelle
  'Bordereau envoyé au vendeur',
  'Le paiement a été validé',
];
const PARTI = [
  'Commande expédiée et en cours d\'acheminement ! ',
  'Commande livrée ! ',
  "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais",
  "Commande finalisée - l'acheteur a validé la commande",
  'Commande annulée - article indisponible ',
  'Remboursement effectué',
  'Commande non réclamée - Retournée à l\'expéditeur.rice',
  'Le paiement a échoué',
];
// Ce dont on ne sait RIEN : ça ne doit jamais valoir « le colis est parti ».
const MUET = ['1', '', '  ', '42', null, undefined, 'Statut inventé par Vinted demain'];

let e = 0;
for (const s of ATTEND) if (etat(s) !== 'attend') { e++; console.log('   ↳ devrait ATTENDRE : ' + JSON.stringify(s) + ' → ' + etat(s)); }
e ? nok(e + ' statut(s) « le colis reste à poster » mal lus')
  : ok('les 3 statuts « le colis reste à poster » sont reconnus (dont celui d\'après génération)');

e = 0;
for (const s of PARTI) if (etat(s) !== 'parti') { e++; console.log('   ↳ devrait être PARTI : ' + JSON.stringify(s) + ' → ' + etat(s)); }
e ? nok(e + ' statut(s) de colis parti mal lus')
  : ok('les 8 statuts de colis parti / annulé sont reconnus');

e = 0;
for (const s of MUET) if (etat(s) !== null) { e++; console.log('   ↳ devrait être MUET : ' + JSON.stringify(s) + ' → ' + etat(s)); }
e ? nok(e + ' valeur(s) illisible(s) prise(s) pour un verdict', 'un code numérique n\'est pas un libellé')
  : ok('un code numérique ou un libellé inconnu ne tranche RIEN (jamais « parti »)');

// ── le câblage : le détail ne doit trancher que s'il dit quelque chose ───────
/const e = etatExpedition\(d\.st\);\s*\n\s*if \(e\) return e === 'attend';/.test(BG)
  ? ok('encoreAExpedier n\'écoute le détail que lorsqu\'il est lisible')
  : nok('encoreAExpedier retombe sur la commande quand le détail est muet',
        'sinon un statut inconnu fait disparaître la vente');

// ── le libellé et le filtre lisent la MÊME source (§11) ─────────────────────
/aGenerer: aGenererBordereau\(stFrais\)/.test(BG) && /emis: !aGenererBordereau\(stFrais\)/.test(BG)
  ? ok('la ligne est ÉTIQUETÉE avec le statut qui la FILTRE (une seule source)')
  : nok('aGenerer/emis lisent encore la commande périmée',
        'la ligne survivait grâce au détail frais mais se décrivait avec l\'ancien statut');
/const statutFrais = \(tx, statutCommande, capCommande\) =>/.test(BG)
  ? ok('statutFrais existe : le statut qui gouverne est nommé une fois')
  : nok('pas de statutFrais');

// ── la génération ne doit pas travailler sur un statut périmé ───────────────
/const ventes = ventesBrutes\.map\(o => \(o \? \{ \.\.\.o, status: statutDe\(o\) \} : o\)\)/.test(BG)
  ? ok('la génération lit le statut le plus frais (plus de regénération d\'une étiquette existante)')
  : nok('genererBordereauxEnAttente travaille encore sur le statut de la commande',
        '1ʳᵉ passe : regénère pour rien · 2ᵉ passe : refuse d\'aller chercher le PDF');
/harvest_\$\{uid\}_txn_\*&select=id,st:data->payload->transaction->shipment->>status_title,cap:data->>capturedAt/.test(BG)
  ? ok('… et le lit en SCALAIRES (§34 : jamais select=data)')
  : nok('la lecture du détail n\'est pas projetée en scalaires');

// ── non-régression : sur le vocabulaire des COMMANDES, les deux règles
//    doivent dire la même chose (sinon on aurait déplacé le problème).
const aw = new Function('s', 'return ' + (BG.match(/const awaitingShip = \((s)\) => ([^\n]*?);\n/) || [])[2] + ';');
const CMD = [
  ["Commande finalisée - l'acheteur a validé la commande", false],
  ['Remboursement effectué', false],
  ["Commande expédiée et en cours d'acheminement ! ", false],
  ['Bordereau envoyé au vendeur', true],
  ['Le paiement a été validé', true],
  ["La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", false],
  ["Commande non réclamée - Retournée à l'expéditeur.rice", false],
  ['Commande livrée ! ', false],
];
e = 0;
for (const [s, att] of CMD) {
  if (aw(s) !== att) { e++; console.log('   ↳ awaitingShip(' + JSON.stringify(s) + ') = ' + aw(s)); }
  if ((etat(s) === 'attend') !== att) { e++; console.log('   ↳ etatExpedition(' + JSON.stringify(s) + ') = ' + etat(s)); }
}
e ? nok(e + ' désaccord(s) sur le vocabulaire des commandes')
  : ok('sur les 8 statuts de COMMANDE réels, les deux règles sont d\'accord (aucune régression)');

console.log(ko ? '\n' + ko + ' contrôle(s) en échec.'
               : '\nUne vente ne peut plus disparaître sur un statut qu\'on ne sait pas lire,\nni s\'afficher « à générer » alors que son bordereau existe.');
process.exit(ko ? 1 : 0);
