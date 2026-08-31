#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// UN COLIS QUE TU ENVOIES N'EST JAMAIS UN COLIS À RETIRER.
// Mesuré le 31 août sur les 128 lignes de suivi réelles : 76 concernent des
// colis SORTANTS (ses ventes qui partent). L'un d'eux — le Mondial Relay
// 74950536, « Votre colis est entre de bonnes mains 📦 », c'est-à-dire sa
// propre preuve de dépôt — était classé « disponible », donc affiché comme un
// colis à aller chercher puis promu en « jamais retiré, va le réclamer ».
//
// La règle doit vivre AUX DEUX ENDROITS (§5.37, §5.49) :
//   • au serveur, pour les emails à venir ;
//   • dans l'app, parce que les 128 lignes déjà en base ne seront JAMAIS
//     réécrites — un correctif serveur seul ne changerait rien à son écran.
// ────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = R('src/App.jsx'), srv = R('api/email-inbound.js');
let ko = 0;
const ok  = m => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// 1) la règle existe des deux côtés
/const sensColis\s*=/.test(app) ? ok("l'app sait reconnaître un colis sortant")
                                : nok("l'app a la règle 'colis sortant'");
/SUJ_SORTANT/.test(srv) ? ok('le serveur sait reconnaître un colis sortant')
                        : nok("le serveur a la règle 'colis sortant'");

// 2) elles tranchent PAREIL — sur les sujets réellement relevés en base
const mot = s => s.match(/\/(.*)\/[a-z]*;/);
const reApp = new RegExp((app.match(/const SUJET_SORTANT = \/(.+?)\/i;/)||[])[1] || 'ZZZ', 'i');
const reSrv = new RegExp((srv.match(/const SUJ_SORTANT = \/(.+?)\/;/)||[])[1] || 'ZZZ', 'i');
const SORTANTS = [
  'Votre colis est entre de bonnes mains 📦',
  'Confirmation du dépôt de votre colis',
  'Votre colis est déposé !',
];
const JAMAIS = [   // ceux-là DOIVENT rester des colis à retirer
  'Votre colis Chronopost est arrivé en consigne Pickup',
  'Votre colis 60385202 est DISPONIBLE',
  'Votre colis VINTED est arrivé en relais Pickup',
];
let d = 0;
for (const s of SORTANTS) if (!reApp.test(s) || !reSrv.test(s)) { d++; console.log('   ↳ non reconnu : ' + s); }
d ? nok(d + ' sujet(s) de dépôt non reconnus des deux côtés')
  : ok('les 3 sujets de dépôt réels sont reconnus par l\'app ET le serveur');
let f = 0;
for (const s of JAMAIS) if (reApp.test(s) || reSrv.test(s)) { f++; console.log('   ↳ pris à tort : ' + s); }
f ? nok(f + ' colis à retirer classés « sortant » par erreur')
  : ok('aucun colis réellement à retirer n\'est pris pour un envoi');

// 3) le sortant ne peut pas revenir par la porte de derrière
/if \(sensColis\(t\) === 'sortant'\) return false;/.test(app)
  ? ok('un colis sortant ne peut pas être « à retirer »')
  : nok('isColisActive écarte les colis sortants');
(app.match(/sensColis\(t\) === 'sortant'/g) || []).length >= 2
  ? ok('… ni retomber dans « colis jamais retirés »')
  : nok('le panneau « jamais retirés » écarte aussi les sortants',
        'sinon la fausse alerte est juste déplacée d\'un bloc');

// 4) le serveur ne doit jamais poser « available » sur un dépôt
/if \(sortant\)\s*\{ status = 'transit'/.test(srv)
  ? ok('le serveur classe un dépôt en « transit », jamais « à retirer »')
  : nok("le serveur ne classe pas un dépôt en « à retirer »");

console.log(ko ? '\n' + ko + ' contrôle(s) en échec.' : '\nUn colis sortant ne peut plus être présenté comme un colis à retirer.');
process.exit(ko ? 1 : 0);
