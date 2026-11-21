// ============================================================
// Sync Vinted Emails → Firebase
// Coller dans Google Apps Script (script.google.com)
// Déployer comme Web App (exécuter en tant que : Moi)
// Lancer setupTrigger() une seule fois pour activer la sync auto
// ============================================================

const FIREBASE_BASE = 'https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale';

function fbGet(path) {
  const res = UrlFetchApp.fetch(`${FIREBASE_BASE}/${path}.json`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const txt = res.getContentText();
  return txt === 'null' ? null : JSON.parse(txt);
}

function fbPut(path, data) {
  UrlFetchApp.fetch(`${FIREBASE_BASE}/${path}.json`, {
    method: 'PUT',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
}

// Extraction des infos depuis un email de vente Vinted
function parseSaleEmail(subject, body, date, recipient) {
  const text = subject + ' ' + body;

  // Numéro de vente
  let numero = null;
  const numPatterns = [
    /(?:vente|commande|order|n°)\s*[:#]?\s*(\d{8,})/i,
    /(?:article|référence)\s*[:#]?\s*(\d{6,})/i,
    /(\d{10,})/,
  ];
  for (const p of numPatterns) {
    const m = text.match(p);
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

  // Prix de vente
  let sellPrice = null;
  const pricePatterns = [
    /(?:tu as gagné|vous avez gagné|montant|prix de vente|total|prix)\s*[:\-]?\s*([\d]+[.,][\d]{2})\s*€/i,
    /([\d]+[.,][\d]{2})\s*€/,
  ];
  for (const p of pricePatterns) {
    const m = text.match(p);
    if (m) { sellPrice = parseFloat(m[1].replace(',', '.')); break; }
  }

  // Compte : extrait de l'adresse destinataire
  const compte = recipient ? recipient.split('@')[0] : '';
  const dateStr = Utilities.formatDate(date, 'Europe/Paris', 'dd/MM/yyyy');

  return { numero, modele, sellPrice, date: dateStr, compte };
}

// Détecte les emails de paiement reçu ("argent disponible")
function parsePaymentEmail(subject, body, date) {
  const text = subject + ' ' + body;
  const subjectLower = subject.toLowerCase();

  const isPayment = ['argent disponible', 'virement', 'paiement reçu', 'fonds disponibles', 'tu as reçu']
    .some(s => subjectLower.includes(s));
  if (!isPayment) return null;

  // Numéro de vente lié
  let numero = null;
  const numPatterns = [
    /(?:vente|commande|order|n°)\s*[:#]?\s*(\d{8,})/i,
    /(\d{10,})/,
  ];
  for (const p of numPatterns) {
    const m = text.match(p);
    if (m) { numero = m[1]; break; }
  }

  // Montant reçu
  let amount = null;
  const m = text.match(/([\d]+[.,][\d]{2})\s*€/);
  if (m) amount = parseFloat(m[1].replace(',', '.'));

  const dateStr = Utilities.formatDate(date, 'Europe/Paris', 'dd/MM/yyyy');
  return { numero, amount, receiveDate: dateStr };
}

function syncVintedEmails() {
  const saleQueries = [
    'from:no-reply@vinted.fr newer_than:7d',
    'from:noreply@vinted.fr newer_than:7d',
    'from:vinted newer_than:7d subject:vendu',
  ];

  const allMessages = [];
  saleQueries.forEach(q => {
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

  const incoming = fbGet('vinted_incoming_sales') || [];
  const existingIds = new Set(incoming.map(v => v.emailId));
  const bordereaux = fbGet('vinted_bordereaux') || [];
  const existingNums = new Set(bordereaux.map(b => String(b.numero || '')).filter(Boolean));

  // Paiements reçus
  const incomingPayments = fbGet('vinted_incoming_payments') || [];
  const existingPaymentIds = new Set(incomingPayments.map(p => p.emailId));
  const newPayments = [];

  const newSales = [];

  allMessages.forEach(msg => {
    const emailId = msg.getId();
    const subject = msg.getSubject();
    const body = msg.getPlainBody() || msg.getBody().replace(/<[^>]+>/g, ' ');
    const date = msg.getDate();
    const recipient = msg.getTo();
    const subjectLower = subject.toLowerCase();

    // Email de paiement reçu
    if (!existingPaymentIds.has(emailId)) {
      const payment = parsePaymentEmail(subject, body, date);
      if (payment) {
        existingPaymentIds.add(emailId);
        newPayments.push({ emailId, ...payment });
        Logger.log(`Paiement reçu : N°${payment.numero} — ${payment.amount}€ — ${payment.receiveDate}`);
      }
    }

    // Email de vente
    if (existingIds.has(emailId)) return;
    const isSale = ['vendu', 'vente confirmée', 'nouvelle vente', 'ta vente', 'transaction confirmée']
      .some(s => subjectLower.includes(s));
    if (!isSale) return;

    const info = parseSaleEmail(subject, body, date, recipient);
    const num = info.numero || ('email_' + emailId.slice(-8));

    if (info.numero && existingNums.has(String(info.numero))) return;

    existingIds.add(emailId);
    existingNums.add(String(num));

    newSales.push({
      id: 'email_' + emailId,
      emailId,
      numero: num,
      modele: info.modele || '',
      sellPrice: info.sellPrice,
      date: info.date,
      compte: info.compte,
      statut: 'à imprimer',
      paiement: 'en attente',
      source: 'email',
    });

    Logger.log(`Nouvelle vente : N°${num} — ${info.modele} — ${info.sellPrice}€ — ${info.date}`);
  });

  if (newSales.length > 0) {
    fbPut('vinted_incoming_sales', [...newSales, ...incoming]);
    Logger.log(`${newSales.length} nouvelle(s) vente(s) ajoutée(s)`);
  }

  if (newPayments.length > 0) {
    fbPut('vinted_incoming_payments', [...newPayments, ...incomingPayments]);
    Logger.log(`${newPayments.length} paiement(s) détecté(s)`);
  }

  return newSales.length;
}

function doGet(e) {
  const added = syncVintedEmails();
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', added, timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// À lancer UNE SEULE FOIS depuis l'éditeur Apps Script
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncVintedEmails')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Déclencheur horaire activé ✓');
}
