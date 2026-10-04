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

const LABEL = 'vrm-traite'; // PREUVE DE STOCKAGE : posée SEULEMENT quand VRM confirme (2xx)

// ── MÉNAGE DE LA BOÎTE ───────────────────────────────────────────────
// Julien, 4 oct. : « supprimer les mails si l'app conserve les données ».
// On ne touche QU'AUX emails labellisés `vrm-traite` — donc confirmés rangés
// dans VRM — et plus vieux que N jours. Jamais un email sans label.
//   'archive'  (défaut, SÛR) → sortis de la boîte mais GARDÉS sous le label,
//              récupérables : le filet de re-lecture reste intact (ex. l'email
//              Vinted Go re-traité le 4 oct. parce qu'on l'avait encore).
//   'corbeille' → vraie suppression (corbeille Gmail, purgée après ~30 j).
//              Forcée à 90 j minimum : au-delà, tout correctif d'analyseur a
//              déjà tourné. Ne bascule là que pour VRAIMENT libérer de l'espace.
const CLEANUP_MODE = 'archive';   // 'archive' (sûr) | 'corbeille' (supprime, ≥90 j)
const CLEANUP_MIN_AGE_DAYS = 6;   // Julien : « tous les mails de plus de 6 jours »

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
  const threads = GmailApp.search('{from:(vinted OR mondialrelay OR chronopost OR privaterelay OR icloudmail) subject:(vinted OR vendu OR bordereau OR colis OR offre OR message OR achat OR commande OR facture)} -label:' + LABEL + ' after:' + getStartDate());

  let sent = 0;
  threads.forEach(thread => {
    // ⚠️⚠️ LE LABEL EST UNE PREUVE DE STOCKAGE — on ne le pose QUE si VRM a
    //   confirmé (2xx) CHAQUE message du fil. api/email-inbound renvoie 503
    //   quand il n'a PAS pu ranger (Supabase down). L'ancien code labellisait
    //   quand même → un email « transféré » pendant une panne était marqué
    //   traité puis jamais rangé, et le ménage l'aurait supprimé : ce sont les
    //   3 jours de ventes/bordereaux/suivis perdus de septembre. Sans label, le
    //   fil repasse au tour suivant ; api/email-inbound est idempotent (upsert
    //   par id), donc re-transférer un message déjà rangé ne crée pas de doublon.
    let tousOk = true;
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

        const code = resp.getResponseCode();
        Logger.log(msg.getSubject() + ' → ' + code + ' ' + resp.getContentText().slice(0, 120));
        if (code >= 200 && code < 300) sent += 1;   // VRM a confirmé le rangement
        else tousOk = false;                        // 503/erreur → on réessaiera, pas de label
      } catch (e) {
        tousOk = false;                             // échec réseau → surtout pas de label
        Logger.log('Erreur sur "' + msg.getSubject() + '" : ' + e);
      }
    });
    if (tousOk) thread.addLabel(label);   // confirmé rangé → marqué (et donc nettoyable)
  });

  Logger.log(sent + ' email(s) transférés à VRM.');

  // Envoie les factures Pro en attente (préparées par l'app).
  sendQueuedInvoices();

  // Ménage : sort de la boîte les emails CONFIRMÉS rangés, de plus de 6 jours.
  nettoyerTraites();
}

// ════════════════════════════════════════════════════════════════════
// MÉNAGE — « supprimer les mails si l'app conserve les données »
// On ne touche QU'AUX emails portant `vrm-traite` (= VRM a confirmé le
// stockage, cf. la correction du label ci-dessus) ET plus vieux que
// CLEANUP_MIN_AGE_DAYS. Un email SANS label n'est jamais touché : s'il n'est
// pas confirmé rangé, le sortir serait la perte qu'on s'interdit.
//   'archive'  → quitte la boîte, reste sous le label, récupérable.
//   'corbeille'→ supprimé pour de bon (≥ 90 j seulement).
// ════════════════════════════════════════════════════════════════════
function nettoyerTraites() {
  const label = GmailApp.getUserLabelByName(LABEL);
  if (!label) return;                       // rien n'a encore été confirmé
  const corbeille = (CLEANUP_MODE === 'corbeille');
  const ageJours = corbeille ? Math.max(90, CLEANUP_MIN_AGE_DAYS) : CLEANUP_MIN_AGE_DAYS;
  const avant = new Date(Date.now() - ageJours * 86400000);
  const y = avant.getFullYear() + '/' + ('0' + (avant.getMonth() + 1)).slice(-2) + '/' + ('0' + avant.getDate()).slice(-2);
  // Labellisé (= confirmé rangé), assez ancien, et — en archive — encore dans la boîte.
  const q = 'label:' + LABEL + (corbeille ? '' : ' in:inbox') + ' before:' + y;
  let n = 0;
  for (let garde = 0; garde < 60; garde++) {   // par lots, quota Gmail
    const lot = GmailApp.search(q, 0, 100);
    if (!lot.length) break;
    lot.forEach(t => { if (corbeille) t.moveToTrash(); else t.moveToArchive(); n++; });
    if (lot.length < 100) break;
  }
  Logger.log(n + ' fil(s) ' + (corbeille ? 'mis à la corbeille' : 'archivés') + ' (déjà rangés par VRM, > ' + ageJours + ' j).');
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
