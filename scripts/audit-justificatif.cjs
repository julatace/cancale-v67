// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DU REÇU D'ACHAT   —   node scripts/audit-justificatif.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le reçu d'achat part chez un COMPTABLE. Trois choses ne doivent jamais s'en
// aller sans qu'on s'en aperçoive :
//   1. il dit QUI achète (l'entité des Factures) — pendant des mois il disait
//      « Ma boutique », parce que `opts.shop` n'était passé par AUCUN appelant ;
//   2. il dit qu'il N'EST PAS la facture de Vinted — sans cette phrase il se lit
//      comme un document officiel, et Vinted n'en émet aucun pour un achat
//      entre particuliers ;
//   3. il porte la date d'établissement et le régime.
//
// ⚠️ Contrôle STATIQUE : la mise en page, elle, se vérifie au banc en générant
// le PDF et en lisant ses coordonnées (§5.36) — un audit ne voit pas un
// chevauchement. Ici on protège ce qui a déjà disparu une fois.
//
// Lecture seule.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');

let ko = 0;
const ok  = (m, d) => console.log('✅ ' + m + (d ? ' — ' + d : ''));
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };
const dit = (c, m, d) => (c ? ok(m, d) : nok(m, d));

// le corps de la fonction, pour ne rien chercher ailleurs dans le fichier
const i = APP.indexOf('const generateAchatJustificatif');
const fin = i < 0 ? -1 : APP.indexOf('\nconst ', i + 40);
const F = i < 0 ? '' : APP.slice(i, fin > 0 ? fin : i + 6000);

dit(F.length > 200, 'la fonction du reçu d\'achat existe');

dit(/vinted_entreprises/.test(F) && /vinted_entreprise_active/.test(F),
  'le reçu lit l\'entité des Factures (raison sociale)',
  /vinted_entreprises/.test(F) ? '' : 'aucune lecture d\'entité');

dit(/siret/i.test(F), 'il peut porter le SIRET');

dit(/companyAddress/.test(F), 'il peut porter l\'adresse');

// ⚠️ LA PHRASE QUI EMPÊCHE DE LE PRENDRE POUR UNE FACTURE VINTED.
// (16 nov., lot factures-mieux) La mise en page et le pied vivent dans src/recuAchat.js.
const RA = fs.readFileSync(path.join(RACINE, 'src/recuAchat.js'), 'utf8');
dit(/import\('\.\/recuAchat\.js'\)/.test(F) && /PIED_RECU_GENERE = "Récapitulatif établi par VRM d'après la commande Vinted — ce n'est pas une facture émise par Vinted\."/.test(RA) && /champs\.pied \|\| PIED_RECU_GENERE/.test(RA),
  'il dit qu\'il n\'est PAS la facture de Vinted (pied du reçu, src/recuAchat.js)');
dit(!/Recu d\\'achat|deductible|Recapitulatif|'Etabli/.test(F + RA), 'les accents sont écrits (« Reçu », « déductible », « Récapitulatif », « Établi »)');

dit(/Etabli le|Établi le/.test(F), 'il porte sa date d\'établissement');

dit(/opts\.numero/.test(F), 'il porte le N° de la paire quand on le connaît');

dit(/regime\s*===\s*'marge'|regime==='marge'/.test(F),
  'il adapte sa mention au régime (micro / marge)');

// (16 nov.) Plus de photo : le modèle choisi par Julien (« je veux que ça soit comme ça ») n'en a pas.
// Ce qui ne doit pas revenir : une photo chargée en direct du CDN Vinted (aucun en-tête CORS).
dit(!/fetch\([^)]*vinted/i.test(F), 'aucune photo chargée en direct du CDN Vinted');

// ⚠️ Une hauteur de bloc FIGÉE laissait un trou de 94 px quand il n'y a ni
// photo ni marque reconnue — visible comme un défaut d'impression.
dit(!/^\s*y -= 92;\s*$/m.test(F), 'la hauteur du bloc « paire » n\'est pas figée');

// Le mot par défaut ne doit plus exister : il masquait l'absence d'entité.
dit(!/'Ma boutique'/.test(F), 'plus de « Ma boutique » par défaut');

console.log(ko
  ? `\n${ko} contrôle(s) non conforme(s).`
  : '\nLe reçu d\'achat dit qui achète, et ne se fait pas passer pour une facture Vinted.');
process.exit(ko ? 1 : 0);
