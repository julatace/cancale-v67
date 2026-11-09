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
module.exports = { midiParis: process.env.VRM_NOTIF_HORLOGE };
