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
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

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
  // Emails Vinted + transporteurs (suivi colis), pas encore traités,
  // reçus depuis la date réglée dans l'app
  // privaterelay / icloudmail : emails Vinted passés par une adresse masquée
  // iCloud (Apple réécrit parfois l'expéditeur). Les emails non pertinents
  // sont simplement classés « ignoré » par le serveur, sans rien polluer.
  // Deux filets : par EXPÉDITEUR (emails automatiques : Vinted, transporteurs,
  // relais Apple des adresses masquées) ET par SUJET (emails transférés À LA
  // MAIN — un transfert manuel a ton adresse comme expéditeur, mais garde le
  // sujet d'origine : « Fwd: Ton article s'est vendu ! »...).
  const threads = GmailApp.search('{from:(vinted OR mondialrelay OR chronopost OR privaterelay OR icloudmail) subject:(vinted OR vendu OR bordereau OR colis OR offre OR message)} -label:' + LABEL + ' after:' + getStartDate());

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

  // Envoie les factures Pro en attente (préparées par l'app).
  sendQueuedInvoices();
}

// ════════════════════════════════════════════════════════════════════
// FACTURATION PRO — envoi des factures en file d'attente
// L'app (via api/email-inbound) prépare les factures dans Supabase avec
// status='queued' UNIQUEMENT si l'utilisateur a activé l'envoi auto
// (ou s'il clique « Envoyer » manuellement sur une facture). Ce script
// les envoie depuis cette boîte Gmail puis les marque 'sent'.
// ════════════════════════════════════════════════════════════════════
function sendQueuedInvoices() {
  const headers = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY };
  let rows, cfg;
  try {
    rows = JSON.parse(UrlFetchApp.fetch(SUPA + '/rest/v1/app_data?id=like.email_invoice_*&select=id,data', { headers: headers, muteHttpExceptions: true }).getContentText());
    const cfgRows = JSON.parse(UrlFetchApp.fetch(SUPA + '/rest/v1/app_data?id=eq.vrm_pro_facture&select=data', { headers: headers, muteHttpExceptions: true }).getContentText());
    cfg = (cfgRows[0] && cfgRows[0].data) || null;
  } catch (e) { Logger.log('Factures : lecture impossible — ' + e); return; }

  if (!cfg || !cfg.actif) return; // facturation coupée dans l'app → on ne touche à rien
  const queued = (rows || []).filter(r => r.data && r.data.status === 'queued' && r.data.buyerEmail);
  if (queued.length === 0) return;

  queued.forEach(row => {
    try {
      const d = row.data;
      const opts = { htmlBody: d.html, name: cfg.nom || 'Facturation' };
      // Logo intégré dans l'email (le base64 des réglages devient une image inline)
      if (cfg.logo && cfg.logo.indexOf('base64,') > -1) {
        try {
          const b64 = cfg.logo.split('base64,')[1];
          const mime = (cfg.logo.match(/^data:([^;]+);/) || [])[1] || 'image/png';
          opts.inlineImages = { logoFacture: Utilities.newBlob(Utilities.base64Decode(b64), mime, 'logo') };
        } catch (e) {}
      }
      GmailApp.sendEmail(
        d.buyerEmail,
        'Votre facture ' + d.number + (cfg.nom ? ' – ' + cfg.nom : ''),
        'Bonjour,\n\nVeuillez trouver votre facture ' + d.number + ' pour votre achat Vinted.\n\nMerci pour votre achat !',
        opts
      );
      // Marque la facture comme envoyée.
      const sentData = {};
      for (const k in d) sentData[k] = d[k];
      sentData.status = 'sent';
      sentData.sentAt = new Date().toISOString();
      UrlFetchApp.fetch(SUPA + '/rest/v1/app_data?id=eq.' + encodeURIComponent(row.id), {
        method: 'patch',
        contentType: 'application/json',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, Prefer: 'return=minimal' },
        payload: JSON.stringify({ data: sentData }),
        muteHttpExceptions: true,
      });
      Logger.log('Facture ' + d.number + ' envoyée à ' + d.buyerEmail);
    } catch (e) {
      Logger.log('Erreur envoi facture : ' + e);
    }
  });
}

// Outil : retire l'étiquette pour re-traiter les anciens emails (à la main)
function resetLabels() {
  const label = GmailApp.getUserLabelByName(LABEL);
  if (!label) return;
  GmailApp.search('label:' + LABEL).forEach(t => t.removeLabel(label));
  Logger.log('Étiquettes réinitialisées.');
}
