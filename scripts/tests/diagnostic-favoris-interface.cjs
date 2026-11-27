// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS — LE DIAGNOSTIC (27 nov., tests-unitaires-verts)
//
//  Jusqu'au 20 nov., ce test montait le composant React `src/DiagnosticFavoris.jsx` (bouton « Vérifier que l'extension
//  lit tes notifications », rapport copiable). Il a été RETIRÉ avec l'écran Favoris de l'app (95ce6ea4d, « Ateliers
//  d'action retirés » ; décision de Julien du 20 nov. : les gestes de plateforme passent par le panneau de l'extension —
//  docs/passation/2026-11-20-actions-extension.md). Le test restait rouge (« Could not resolve ./src/DiagnosticFavoris.jsx »)
//  et n'était lancé par aucun workflow. La RÈGLE du diagnostic reste (src/diagnosticFavoris.js), jugée par
//  scripts/tests/diagnostic-favoris.test.mjs : chaque garantie y est reportée (juge lancé, contrôle nommé VERT,
//  scripts/tests/_garanties-reportees.cjs). Celles qui ne tenaient qu'au composant (bouton, copie, cibles) sont « retirées ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { juger } = require('./_garanties-reportees.cjs');
const ECRAN = 'objet retiré avec src/DiagnosticFavoris.jsx (20 nov.)';
const JUGES = { diag: { args: ['--test', 'scripts/tests/diagnostic-favoris.test.mjs'] } };

juger('diagnostic-favoris-interface', [
  { garantie: 'aucune lecture au montage ou au dépliage', retiree: ECRAN + ' : plus de composant qui se monte ni se déplie' },
  { garantie: 'structure lisible, valeurs privées absentes', ou: [['diag', /le diagnostic ne contient aucune valeur privée ni nom de clé dynamique/], ['diag', /la structure est bornée et ne promet pas de liste complète/]] },
  { garantie: 'copie du rapport affiché', retiree: ECRAN + ' : plus de bouton « Copier le diagnostic »' },
  { garantie: 'la capture seule ne prétend pas vérifier une ouverture', ou: [['diag', /le rapprochement distingue trace périmée, champ différent et relation native sans divulgation/]] },
  { garantie: 'le même bouton joint le résultat réel de la dernière ouverture', retiree: ECRAN },
  { garantie: 'le nouveau contrôle ne relance aucune lecture ni action', ou: [['diag', /la lecture cible exactement une ligne et son propriétaire, sans écriture/]] },
  { garantie: 'pas de débordement horizontal ; cibles tactiles de 44 px', retiree: ECRAN + ' : plus d’écran à mesurer' },
  { garantie: 'absence de capture distincte d’une erreur', ou: [['diag', /une capture absente est distincte d’une lecture en erreur ou ambiguë/], ['diag', /une panne de lecture des traces reste une panne, pas une absence de requêtes/]] },
  { garantie: 'une erreur ne réutilise pas le précédent résultat', ou: [['diag', /une capture absente est distincte d’une lecture en erreur ou ambiguë/]] },
  { garantie: 'compte non sélectionné : rien ne part', ou: [['diag', /un compte invalide ou une session différente ne déclenche aucune requête/]] },
  { garantie: 'réponse de l’ancien propriétaire rejetée', ou: [['diag', /une réponse d’un autre propriétaire ou un changement de session est rejeté/], ['diag', /les captures d’un autre compte ou d’un autre type sont rejetées/]] },
  { garantie: 'aucun appel d’écriture ni action marketplace', ou: [['diag', /la lecture cible exactement une ligne et son propriétaire, sans écriture/], ['diag', /les écritures observées d’un autre propriétaire ou compte ne rejoignent jamais le rapport/]] },
], JUGES);
