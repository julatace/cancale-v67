#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// LA CHAÎNE PUSH NE PEUT PLUS CASSER EN SILENCE.
//
// ⚠️ Ce qui s'est passé (mesuré le 31 août) : en sortant la clé privée VAPID du
// dépôt public (§5.53), la paire a été RÉGÉNÉRÉE et la nouvelle clé privée n'a
// jamais été communiquée ni posée sur Vercel. Résultat : depuis le 25 août,
// `sendPushToAll` sortait sur « VAPID_PRIVATE_KEY absente » et **zéro
// notification** ne partait — pendant que l'écran affichait « activées ».
// Julien : « remets les notifs, ça ne marche plus du tout ». Il avait raison.
//
// Trois contrôles, tous silencieux à l'œil nu s'ils cassent :
//   1. la clé PUBLIQUE de l'app et celle du serveur sont IDENTIQUES
//      (si elles divergent, chaque abonnement est scellé sur une clé que le
//       serveur n'utilise pas : refus à l'envoi, et rien ne le dit) ;
//   2. AUCUNE clé privée n'est écrite en dur (le dépôt est public) ;
//   3. l'app SAIT dire que le serveur ne peut pas envoyer — sinon on croit
//      les notifications actives alors qu'il ne part rien.
// ────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

const app = R('src/App.jsx');
const srv = R('api/_lib/push.js');

// 1) une seule clé publique, des deux côtés
const kApp = (app.match(/VAPID_PUBLIC_KEY\s*=\s*'([^']+)'/) || [])[1] || '';
const kSrv = (srv.match(/VAPID_PUBLIC\s*=\s*'([^']+)'/) || [])[1] || '';
if (!kApp || !kSrv) nok('les deux clés publiques sont présentes', `app=${!!kApp} serveur=${!!kSrv}`);
else if (kApp !== kSrv) nok('app et serveur partagent LA MÊME clé publique',
  `app ${kApp.slice(0, 14)}… ≠ serveur ${kSrv.slice(0, 14)}…`);
else if (kApp.length !== 87) nok('la clé publique a la bonne longueur (87)', `${kApp.length} caractères`);
else ok('app et serveur partagent la même clé publique (87 car.)');

// 2) aucune clé privée en dur — le dépôt est PUBLIC
const enDur = /VAPID_PRIVATE\s*=\s*(?:process\.env\.\w+\s*\|\|\s*)?['"][A-Za-z0-9_-]{20,}['"]/.test(srv);
enDur ? nok('aucune clé privée VAPID en dur dans le dépôt public')
      : ok('aucune clé privée VAPID en dur');
/VAPID_PRIVATE\s*=\s*process\.env\.VAPID_PRIVATE_KEY/.test(srv)
  ? ok('la clé privée vient UNIQUEMENT de la variable d\'environnement')
  : nok('la clé privée vient de la variable d\'environnement');

// 3) sans clé, le serveur le DIT, et l'app l'affiche
/if\s*\(\s*!PUSH_PRET\s*\)/.test(srv) && /VAPID_PRIVATE_KEY absente/.test(srv)
  ? ok('le serveur annonce clairement « clé absente » au lieu d\'échouer en silence')
  : nok('le serveur annonce « clé absente »');
/\/api\/push\?etat=1/.test(app)
  ? ok('l\'app interroge l\'état du serveur (« peut-il envoyer ? »)')
  : nok('l\'app interroge /api/push?etat=1');
/ne peut envoyer aucune notification/i.test(app)
  ? ok('l\'app AFFICHE que le serveur ne peut rien envoyer')
  : nok('l\'app affiche l\'alerte « serveur sans clé »');
// la route GET doit exister côté serveur, sinon l'app reçoit 405 et n'affiche rien
/req\.method\s*===\s*'GET'/.test(R('api/push.js'))
  ? ok('la route GET ?etat=1 existe côté serveur')
  : nok('la route GET ?etat=1 existe', 'l\'app recevrait 405 et n\'alerterait jamais');

// 3bis) ⚠️ `total` NE DOIT JAMAIS MENTIR SUR LE NOMBRE D'APPAREILS.
// Sans clé, l'ancien code sortait sur `{sent:0, total:0}` — sans même lire la
// liste. L'app lit ce chiffre et affichait « Aucun appareil abonné » alors que
// les 2 téléphones étaient bien enregistrés (mesuré le 31 août). Le vendeur a
// donc cherché du côté de son téléphone pendant que le problème était la clé.
!/if \(!PUSH_PRET\) return \{ sent: 0, total: 0/.test(srv)
  ? ok('sans clé, on compte quand même les appareils abonnés')
  : nok('`total` dit le vrai nombre d\'appareils', 'l\'app afficherait « aucun appareil abonné »');
// 4) ⚠️ UN ABONNEMENT SCELLÉ SUR UNE ANCIENNE CLÉ DOIT ÊTRE PURGÉ.
// Mesuré en direct sur les 2 appareils du vendeur : Chrome répond 403 « the
// VAPID credentials … do not correspond », Apple 400 « VapidPkHashMismatch ».
// L'ancien code ne purgeait que sur 404/410 : ces abonnements restaient donc
// comptés comme vivants pour toujours, et l'écran affichait « 2 appareils
// abonnés » pendant que rien n'arrivait.
/cleSansRapport/.test(srv) && /VapidPkHashMismatch/i.test(srv)
  ? ok('un abonnement scellé sur une ancienne clé est reconnu et purgé')
  : nok('les abonnements à clé périmée sont purgés', 'ils resteraient comptés comme vivants');
// ⚠️ …mais JAMAIS sur un 403/400 nu : un refus passager effacerait tous les
// appareils d'un coup. Le MOTIF doit être exigé.
srv.includes('code !== 400 && code !== 403') && /return false;/.test(srv)
 && /(do not correspond|mismatch|invalid)/.test(srv)
  ? ok('la purge exige le MOTIF, jamais un 403/400 nu')
  : nok('la purge exige le motif', 'un refus passager viderait la liste');
// et l'app doit DIRE quoi faire, sinon on lit « 2 abonnés, 0 joint » sans savoir
/j.perimes/.test(app)
  ? ok('l\'app dit quoi faire quand les abonnements étaient périmés')
  : nok('l\'app explique le cas « clé périmée »');

console.log(ko ? `\n${ko} maillon(s) cassé(s) dans la chaîne push.`
                : '\nLa chaîne push ne peut plus casser en silence.');
process.exit(ko ? 1 : 0);
