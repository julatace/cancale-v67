// ════════════════════════════════════════════════════════════════════
// VRM — Transfert Gmail → app (script Google Apps Script)
//
// Rôle : toutes les 5 minutes, prend les emails Vinted pas encore
// traités et les POSTe tels quels à l'app (api/email-inbound), qui se
// charge de TOUT : parsing (vente / bordereau / argent reçu), rangement
// dans Supabase, et notifications push.
//
// Installation (une fois) :
//   1. script.google.com (connecté avec le Gmail qui reçoit les mails)
//   2. Nouveau projet → coller ce fichier → 💾 Enregistrer
//   3. Exécuter la fonction `forwardVintedEmails` une fois → autoriser
//   4. ⏰ Déclencheurs (icône réveil) → Ajouter → forwardVintedEmails,
//      Temporel, Toutes les 5 minutes → Enregistrer
// ════════════════════════════════════════════════════════════════════

const ENDPOINT = 'https://vrm.center/api/email-inbound';
// Clé secrète (optionnelle) : si la variable EMAIL_INBOUND_SECRET est un jour
// définie sur Vercel, mettre la même valeur ici.
const SECRET = '';

const LABEL = 'vrm-traite'; // étiquette posée sur les emails déjà envoyés

function forwardVintedEmails() {
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  // Emails Vinted récents pas encore traités (recherche large : tous domaines Vinted)
  const threads = GmailApp.search('from:vinted -label:' + LABEL + ' newer_than:7d');

  let sent = 0;
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      try {
        const attachments = msg.getAttachments().map(a => ({
          filename: a.getName(),
          contentType: a.getContentType(),
          content: Utilities.base64Encode(a.getBytes()),
        }));

        const payload = {
          from: msg.getFrom(),
          to: msg.getTo(),
          subject: msg.getSubject(),
          text: msg.getPlainBody(),
          html: msg.getBody(),
          attachments: attachments,
        };

        const url = ENDPOINT + (SECRET ? '?key=' + encodeURIComponent(SECRET) : '');
        const resp = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        Logger.log(msg.getSubject() + ' → ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 120));
        sent += 1;
      } catch (e) {
        Logger.log('Erreur sur "' + msg.getSubject() + '" : ' + e);
      }
    });
    thread.addLabel(label);
  });

  Logger.log(sent + ' email(s) transférés à VRM.');
}

// Outil : retire l'étiquette pour re-traiter les anciens emails (à la main)
function resetLabels() {
  const label = GmailApp.getUserLabelByName(LABEL);
  if (!label) return;
  GmailApp.search('label:' + LABEL).forEach(t => t.removeLabel(label));
  Logger.log('Étiquettes réinitialisées.');
}
