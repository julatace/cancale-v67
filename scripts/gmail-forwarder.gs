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

// La date de départ se règle DANS L'APP (Paramètres → Import des emails).
// Elle est stockée dans Supabase ; le script la lit à chaque passage.
// Valeur de secours si l'app n'a encore rien réglé :
const DEFAULT_START = '2026/07/15';

const SUPA = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyMjZ9.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

function getStartDate() {
  try {
    const r = UrlFetchApp.fetch(SUPA + '/rest/v1/app_data?id=eq.vrm_email_config&select=data', {
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
      muteHttpExceptions: true,
    });
    const rows = JSON.parse(r.getContentText());
    const d = rows[0] && rows[0].data && rows[0].data.startDate; // 'AAAA-MM-JJ'
    if (d) return d.replace(/-/g, '/');
  } catch (e) {}
  return DEFAULT_START;
}

const LABEL = 'vrm-traite'; // étiquette posée sur les emails déjà envoyés

function forwardVintedEmails() {
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  // Emails Vinted pas encore traités, reçus depuis la date réglée dans l'app
  const threads = GmailApp.search('from:vinted -label:' + LABEL + ' after:' + getStartDate());

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
