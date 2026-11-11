// scripts/_horloge-notif.cjs
// (8 nov.) Les heures calmes sont ALLUMÉES par défaut (22 h → 8 h, Paris ;
// api/_lib/notif-textes.js). Un banc qui juge AUTRE CHOSE que les heures calmes
// (une arrivée sonne une fois, un regroupement, une adresse…) les rendrait vertes
// le jour et rouges la nuit. On fixe l'instant qui en décide à midi (Paris) du
// jour courant, sauf si le banc l'a déjà posé. `api/_lib/push.js` lit
// `VRM_NOTIF_HORLOGE` pour cette seule décision ; jamais posé en production.
// Un banc qui juge les heures calmes pose lui-même l'heure (ou retire la variable).
if (!process.env.VRM_NOTIF_HORLOGE) {
  const d = new Date();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  process.env.VRM_NOTIF_HORLOGE = `${jour}T11:00:00Z`;   // midi à Paris l'hiver, 13 h l'été : hors heures calmes
}
// (11 nov., lot `notifs-groupees`) La fenêtre de regroupement (15 min par défaut) :
// une horloge figée met TOUT dans la même fenêtre — un banc qui juge « une arrivée
// sonne » verrait la seconde attendre le résumé. Ces bancs jugent autre chose : la
// fenêtre est posée à 0 (chaque notification seule). L'idempotence (objet + jour)
// reste. Le banc qui juge la fenêtre (audit-notifs-groupees) ne charge pas ce fichier.
if (process.env.VRM_NOTIF_FENETRE === undefined) process.env.VRM_NOTIF_FENETRE = '0';
module.exports = { midiParis: process.env.VRM_NOTIF_HORLOGE };
