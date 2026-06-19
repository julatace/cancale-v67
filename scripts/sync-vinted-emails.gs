// ============================================================
// Sync Vinted Emails → Firebase
// Coller dans Google Apps Script (script.google.com)
// Déployer comme Web App (exécuter en tant que : Moi)
// Lancer setupTrigger() une seule fois pour activer la sync auto
// ============================================================

const FIREBASE_BASE = 'https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale';

// Lecture Firebase
function fbGet(path) {
  const res = UrlFetchApp.fetch(`${FIREBASE_BASE}/${path}.json`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const txt = res.getContentText();
  return txt === 'null' ? null : JSON.parse(txt);
}

// Écriture Firebase
function fbPut(path, data) {
  UrlFetchApp.fetch(`${FIREBASE_BASE}/${path}.json`, {
    method: 'PUT',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
}

// Extraction des infos depuis l'email Vinted
function parseSaleEmail(subject, body, date, recipient) {
  // Numéro de vente — Vinted met souvent un grand nombre dans l'objet ou le corps
  let numero = null;
  const numPatterns = [
    /(?:vente|commande|order|n°)\s*[:#]?\s*(\d{8,})/i,
    /(?:article|référence)\s*[:#]?\s*(\d{6,})/i,
    /(\d{10,})/,
  ];
  for (const p of numPatterns) {
    const m = (subject + ' ' + body).match(p);
    if (m) { numero = m[1]; break; }
  }

  // Modèle / article vendu
  let modele = '';
  const modelPatterns = [
    /tu viens de vendre\s*[:\-]?\s*[«""](.+?)[»""]/i,
    /tu viens de vendre\s*[:\-]?\s*(.+?)(?:\r?\n|pour\s+\d)/i,
    /article\s*[:\-]\s*(.+?)(?:\r?\n|\|)/i,
    /vendu\s*[:\-]\s*(.+?)(?:\r?\n|\|)/i,
  ];
  for (const p of modelPatterns) {
    const m = body.match(p);
    if (m) { modele = m[1].trim().slice(0, 80); break; }
  }

  // Compte : détecté depuis l'adresse destinataire
  const compte = recipient ? recipient.split('@')[0] : '';

  const dateStr = Utilities.formatDate(date, 'Europe/Paris', 'dd/MM/yyyy');

  return { numero, modele, date: dateStr, compte };
}

function syncVintedEmails() {
  // Cherche les emails de vente Vinted des 7 derniers jours
  const queries = [
    'from:no-reply@vinted.fr newer_than:7d',
    'from:noreply@vinted.fr newer_than:7d',
    'from:vinted newer_than:7d subject:vendu',
  ];

  const allMessages = [];
  queries.forEach(q => {
    try {
      GmailApp.search(q, 0, 50).forEach(thread => {
        thread.getMessages().forEach(msg => allMessages.push(msg));
      });
    } catch(e) { Logger.log('Erreur query: ' + q + ' → ' + e.message); }
  });

  if (allMessages.length === 0) {
    Logger.log('Aucun email Vinted trouvé');
    return 0;
  }

  // Récupérer les ventes déjà enregistrées dans Firebase (incoming)
  const incoming = fbGet('vinted_incoming_sales') || [];
  const existingIds = new Set(incoming.map(v => v.emailId));

  // Récupérer aussi les bordereaux existants pour éviter les doublons
  const bordereaux = fbGet('vinted_bordereaux') || [];
  const existingNums = new Set(bordereaux.map(b => String(b.numero || '')).filter(Boolean));

  const newEntries = [];

  allMessages.forEach(msg => {
    const emailId = msg.getId();
    if (existingIds.has(emailId)) return;

    const subject = msg.getSubject();
    const subjectLower = subject.toLowerCase();

    // Filtrer uniquement les emails de vente (pas les livraisons, remboursements...)
    const isSale = ['vendu', 'vente confirmée', 'nouvelle vente', 'ta vente', 'transaction confirmée']
      .some(s => subjectLower.includes(s));
    if (!isSale) return;

    const body = msg.getPlainBody() || msg.getBody().replace(/<[^>]+>/g, ' ');
    const date = msg.getDate();
    const recipient = msg.getTo();

    const info = parseSaleEmail(subject, body, date, recipient);
    const num = info.numero || ('email_' + emailId.slice(-8));

    if (info.numero && existingNums.has(String(info.numero))) return; // déjà en bordereau

    existingIds.add(emailId);
    existingNums.add(String(num));

    newEntries.push({
      id: 'email_' + emailId,
      emailId: emailId,
      numero: num,
      modele: info.modele || '',
      date: info.date,
      compte: info.compte,
      statut: 'à imprimer',
      paiement: 'en attente',
      source: 'email',
    });

    Logger.log(`Nouvelle vente : N°${num} — ${info.modele} — ${info.date}`);
  });

  if (newEntries.length > 0) {
    fbPut('vinted_incoming_sales', [...newEntries, ...incoming]);
    Logger.log(`${newEntries.length} nouvelle(s) vente(s) ajoutée(s) dans Firebase`);
  } else {
    Logger.log('Aucune nouvelle vente');
  }

  return newEntries.length;
}

// Web App : appelée par le bouton "Sync" de l'application
function doGet(e) {
  const added = syncVintedEmails();
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', added, timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// À lancer UNE SEULE FOIS depuis l'éditeur Apps Script pour activer la sync automatique toutes les heures
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncVintedEmails')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Déclencheur horaire activé ✓');
}
