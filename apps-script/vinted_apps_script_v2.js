// ═══════════════════════════════════════════════════════════
// VRM — Apps Script Vinted v2
// Synchro Gmail → Firebase (ventes + paiements + bordereaux)
// ═══════════════════════════════════════════════════════════

const FIREBASE_URL = 'https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale';
const LABEL_NAME   = 'vinted-traite';

// Clé secrète Firebase (la même que dans VRM → Paramètres → Clé secrète Firebase).
// Laisser vide ('') tant que les règles Firebase ne sont pas verrouillées.
const FIREBASE_SECRET = '';

// ── Point d'entrée Web App (bouton "Synchroniser" dans l'app) ──
function doGet(e) {
  processVintedEmails();
  return ContentService.createTextOutput(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Déclencheur horaire ──
function processVintedEmails() {
  processVintedSales();
  processVintedPayments();
  processVintedBordereaux();
}

// ════════════════════════════════════════════════════════════
// 1. VENTES
// ════════════════════════════════════════════════════════════
function processVintedSales() {
  const label = getOrCreateLabel(LABEL_NAME);
  const threads = GmailApp.search(
    'from:(noreply@vinted.fr OR no-reply@vinted.fr) -label:' + LABEL_NAME + ' newer_than:14d'
  );

  const existing = firebaseGet('/vinted_incoming_sales') || [];
  const existingIds = new Set(existing.map(s => s.emailId));

  const newSales = [];

  threads.forEach(thread => {
    const msgs = thread.getMessages();
    msgs.forEach(msg => {
      if (!isSaleEmail(msg)) return;
      const emailId = msg.getId();
      if (existingIds.has(emailId)) return;

      const body    = msg.getPlainBody() || msg.getBody();
      const numero  = extractNumero(body, msg.getSubject());
      const modele  = extractModele(body, msg.getSubject());
      const price   = extractPrice(body);
      const taille  = extractTaille(modele + ' ' + body);
      const date    = formatDate(msg.getDate());

      // Données acheteur (disponibles sur les comptes Vinted Pro uniquement)
      const buyerEmail   = extractBuyerEmail(body);
      const buyerName    = extractBuyerName(body);
      const buyerAddress = extractBuyerAddress(body);
      const buyerPseudo  = extractBuyerPseudo(body);

      const sale = {
        id:          emailId,
        emailId:     emailId,
        numero:      numero       || '',
        modele:      modele       || '',
        sellPrice:   price        || '',
        date:        date,
        taille:      taille       || '',
        compte:      '',
        source:      'email',
        isPro:       !!buyerEmail,
        buyerEmail:  buyerEmail   || '',
        buyerName:   buyerName    || '',
        buyerAddress: buyerAddress || '',
        buyerPseudo: buyerPseudo  || '',
      };

      // ── Envoi automatique de la facture ──
      // UNIQUEMENT si l'utilisateur a activé le toggle dans VRM (config lue dans
      // Firebase à chaque exécution → couper le toggle stoppe les envois immédiatement).
      if (buyerEmail && price) {
        const config = getProFactureConfig();
        if (config && config.actif && config.autoSend) {
          try {
            const numFacture = envoyerFactureAuto(sale, config);
            if (numFacture) {
              sale.factureSent   = true;
              sale.factureNumber = numFacture;
              sale.factureSentAt = formatDate(new Date());
            }
          } catch (e) {
            Logger.log('Erreur envoi facture auto : ' + e);
          }
        }
      }

      newSales.push(sale);

      thread.addLabel(label);
    });
  });

  if (newSales.length > 0) {
    const all = [...existing, ...newSales];
    firebasePut('/vinted_incoming_sales', all);
    Logger.log('Ventes ajoutées : ' + newSales.length);
  }
}

// ════════════════════════════════════════════════════════════
// 2. PAIEMENTS
// ════════════════════════════════════════════════════════════
function processVintedPayments() {
  const label = getOrCreateLabel(LABEL_NAME);
  const threads = GmailApp.search(
    'from:(noreply@vinted.fr OR no-reply@vinted.fr) -label:' + LABEL_NAME + ' newer_than:14d'
  );

  const existing = firebaseGet('/vinted_incoming_payments') || [];
  const existingIds = new Set(existing.map(p => p.emailId));
  const newPayments = [];

  threads.forEach(thread => {
    const msgs = thread.getMessages();
    msgs.forEach(msg => {
      if (!isPaymentEmail(msg)) return;
      const emailId = msg.getId();
      if (existingIds.has(emailId)) return;

      const body   = msg.getPlainBody() || msg.getBody();
      const numero = extractNumero(body, msg.getSubject());
      const amount = extractPrice(body);
      const date   = formatDate(msg.getDate());

      newPayments.push({
        numero:      numero || '',
        amount:      amount || '',
        receiveDate: date,
        emailId:     emailId,
      });

      thread.addLabel(label);
    });
  });

  if (newPayments.length > 0) {
    const all = [...existing, ...newPayments];
    firebasePut('/vinted_incoming_payments', all);
    Logger.log('Paiements ajoutés : ' + newPayments.length);
  }
}

// ════════════════════════════════════════════════════════════
// 3. BORDEREAUX (étiquettes d'envoi avec PDF en pièce jointe)
// ════════════════════════════════════════════════════════════
function processVintedBordereaux() {
  const label = getOrCreateLabel(LABEL_NAME);
  const threads = GmailApp.search(
    'from:(noreply@vinted.fr OR no-reply@vinted.fr) -label:' + LABEL_NAME +
    ' (bordereau OR étiquette OR "bon d\'envoi") newer_than:14d'
  );

  // Récupérer les bordereaux déjà traités
  const existingMeta = firebaseGet('/vinted_incoming_bordereaux') || [];
  const existingIds  = new Set(existingMeta.map(b => b.emailId));

  const newBordereaux = [];

  threads.forEach(thread => {
    const msgs = thread.getMessages();
    msgs.forEach(msg => {
      if (!isBordereauEmail(msg)) return;
      const emailId = msg.getId();
      if (existingIds.has(emailId)) return;

      const body    = msg.getPlainBody() || msg.getBody();
      const subject = msg.getSubject();

      // Extraire les données du corps de l'email
      const transaction = extractTransaction(body);
      const suivi       = extractSuivi(body);
      const modele      = extractModeleFromBordereau(body);
      const taille      = extractTaille(modele + ' ' + body);
      const dateLimite  = extractDateLimite(body);
      const transporteur = extractTransporteur(body);
      const date        = formatDate(msg.getDate());

      // Chercher la pièce jointe PDF
      const attachments = msg.getAttachments();
      let pdfBase64 = null;
      attachments.forEach(att => {
        const ct = att.getContentType();
        if (ct === 'application/pdf' || ct === 'application/octet-stream') {
          pdfBase64 = Utilities.base64Encode(att.getBytes());
        }
      });

      const bordereau = {
        emailId:     emailId,
        numero:      transaction || '',
        suivi:       suivi       || '',
        modele:      modele      || '',
        taille:      taille      || '',
        dateLimite:  dateLimite  || '',
        transporteur: transporteur || '',
        date:        date,
        hasPdf:      pdfBase64 !== null,
        source:      'email',
      };

      newBordereaux.push(bordereau);

      // Stocker le PDF séparément dans Firebase si présent
      if (pdfBase64 && transaction) {
        firebasePut('/vinted_bordereau_pdfs/' + transaction, pdfBase64);
        Logger.log('PDF bordereau stocké pour transaction ' + transaction);
      }

      thread.addLabel(label);
    });
  });

  if (newBordereaux.length > 0) {
    const all = [...existingMeta, ...newBordereaux];
    firebasePut('/vinted_incoming_bordereaux', all);
    Logger.log('Bordereaux ajoutés : ' + newBordereaux.length);
  }
}

// ════════════════════════════════════════════════════════════
// FACTURATION PRO — envoi automatique
// La config est écrite par VRM dans /vrm_pro_facture :
//   { actif, autoSend, nom, adresse, codePostal, ville, siret,
//     tva, prefixe, tauxTva, mentions, logo }
// autoSend=false → aucun envoi. L'utilisateur garde le contrôle depuis l'app.
// ════════════════════════════════════════════════════════════

let _proConfigCache = undefined;
function getProFactureConfig() {
  if (_proConfigCache !== undefined) return _proConfigCache;
  _proConfigCache = firebaseGet('/vrm_pro_facture') || null;
  return _proConfigCache;
}

// Attribue le prochain numéro de facture (compteur partagé dans Firebase)
function nextNumeroFacture(config) {
  const counter = (parseInt(firebaseGet('/vrm_invoice_counter'), 10) || 0) + 1;
  firebasePut('/vrm_invoice_counter', counter);
  const prefixe = config.prefixe || 'FA';
  const year = new Date().getFullYear();
  return prefixe + '-' + year + '-' + ('0000' + counter).slice(-4);
}

function envoyerFactureAuto(sale, config) {
  const numFacture = nextNumeroFacture(config);
  const tauxTva  = parseFloat(config.tauxTva || '0') || 0;
  const ttc      = parseFloat(sale.sellPrice) || 0;
  const ht       = tauxTva > 0 ? Math.round(ttc / (1 + tauxTva / 100) * 100) / 100 : ttc;
  const tvaMt    = tauxTva > 0 ? Math.round((ttc - ht) * 100) / 100 : 0;
  const adresse  = [config.adresse, [config.codePostal, config.ville].filter(Boolean).join(' ')].filter(Boolean).join(' – ');
  const eur      = n => n.toFixed(2).replace('.', ',') + ' €';

  const lignesTva = tauxTva > 0
    ? '<tr><td>Sous-total HT</td><td style="text-align:right">' + eur(ht) + '</td></tr>' +
      '<tr><td>TVA ' + tauxTva + ' %</td><td style="text-align:right">' + eur(tvaMt) + '</td></tr>'
    : '<tr><td colspan="2" style="color:#666;font-size:12px">TVA non applicable – art. 293 B du CGI</td></tr>';

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">' +
    (config.logo ? '<img src="cid:logoFacture" style="max-height:80px;margin-bottom:16px" alt="logo"/>' : '') +
    '<h2 style="margin:0 0 4px">FACTURE ' + numFacture + '</h2>' +
    '<p style="color:#666;margin:0 0 20px">Date : ' + (sale.date || formatDate(new Date())) + '</p>' +
    '<table style="width:100%;margin-bottom:20px"><tr>' +
    '<td style="vertical-align:top;font-size:13px"><b>' + (config.nom || '') + '</b><br>' +
    adresse + (config.siret ? '<br>SIRET : ' + config.siret : '') + (config.tva ? '<br>N° TVA : ' + config.tva : '') + '</td>' +
    '<td style="vertical-align:top;text-align:right;font-size:13px"><b>' + (sale.buyerName || '') + '</b><br>' +
    (sale.buyerAddress || '') + '<br>' + sale.buyerEmail + '</td></tr></table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<tr style="background:#f5f5f5"><th style="text-align:left;padding:8px">Article</th><th style="text-align:right;padding:8px">Montant</th></tr>' +
    '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + (sale.modele || 'Article Vinted') + '</td>' +
    '<td style="padding:8px;text-align:right;border-bottom:1px solid #eee">' + eur(ttc) + '</td></tr>' +
    lignesTva +
    '<tr><td style="padding:8px"><b>Total TTC</b></td><td style="padding:8px;text-align:right"><b>' + eur(ttc) + '</b></td></tr>' +
    '</table>' +
    '<p style="color:#27a85d;font-weight:bold">Facture acquittée</p>' +
    (sale.numero ? '<p style="font-size:12px;color:#666">Transaction Vinted n°' + sale.numero + '</p>' : '') +
    (config.mentions ? '<p style="font-size:12px;color:#666;white-space:pre-line">' + config.mentions + '</p>' : '') +
    '</div>';

  const options = {
    htmlBody: htmlBody,
    name: config.nom || 'Facturation',
  };
  // Logo intégré dans l'email (le base64 de VRM devient une image inline)
  if (config.logo && config.logo.indexOf('base64,') > -1) {
    try {
      const b64 = config.logo.split('base64,')[1];
      const mime = (config.logo.match(/^data:([^;]+);/) || [])[1] || 'image/png';
      options.inlineImages = { logoFacture: Utilities.newBlob(Utilities.base64Decode(b64), mime, 'logo') };
    } catch (e) { /* logo illisible → email sans logo */ }
  }

  GmailApp.sendEmail(
    sale.buyerEmail,
    'Votre facture ' + numFacture + (config.nom ? ' – ' + config.nom : ''),
    'Bonjour,\n\nVeuillez trouver votre facture ' + numFacture + ' pour votre achat Vinted.\n\nMerci pour votre achat !',
    options
  );

  // Trace de l'envoi (consultable, et sécurité anti-doublon)
  const sent = firebaseGet('/vinted_sent_invoices') || [];
  sent.push({
    number: numFacture, numero: sale.numero || '', buyerEmail: sale.buyerEmail,
    buyerName: sale.buyerName || '', modele: sale.modele || '',
    montant: ttc, sentAt: new Date().toISOString(),
  });
  firebasePut('/vinted_sent_invoices', sent);

  Logger.log('Facture ' + numFacture + ' envoyée à ' + sale.buyerEmail);
  return numFacture;
}

// ════════════════════════════════════════════════════════════
// DÉTECTEURS D'EMAILS
// ════════════════════════════════════════════════════════════

function isSaleEmail(msg) {
  const s = (msg.getSubject() || '').toLowerCase();
  const b = (msg.getPlainBody() || msg.getBody() || '').toLowerCase().slice(0, 1500);
  if (isBordereauEmail(msg) || isPaymentEmail(msg)) return false;
  return s.includes('vendu') || s.includes('nouvelle vente') || s.includes('article vendu') ||
         b.includes('nouvelle vente') || b.includes('tu as vendu') || b.includes('félicitations') ||
         b.includes('a acheté') || b.includes('vente confirmée');
}

function isPaymentEmail(msg) {
  const s = (msg.getSubject() || '').toLowerCase();
  const b = (msg.getPlainBody() || msg.getBody() || '').toLowerCase().slice(0, 1500);
  return s.includes('paiement') || s.includes('argent disponible') ||
         b.includes('paiement reçu') || b.includes('argent disponible') ||
         b.includes('virement') || b.includes('encaissé');
}

function isBordereauEmail(msg) {
  const s = (msg.getSubject() || '').toLowerCase();
  const b = (msg.getPlainBody() || msg.getBody() || '').toLowerCase().slice(0, 2000);
  return s.includes('bordereau') || s.includes('étiquette') || s.includes("bon d'envoi") ||
         b.includes('bordereau d\'envoi') || b.includes('retrouve ton bordereau') ||
         b.includes('n° de suivi') || b.includes('à envoyer avant le') ||
         msg.getAttachments().some(a => a.getContentType() === 'application/pdf');
}

// ════════════════════════════════════════════════════════════
// EXTRACTEURS — VENTES
// ════════════════════════════════════════════════════════════

function extractNumero(body, subject) {
  const txt = (subject || '') + ' ' + (body || '');
  const patterns = [
    /n°\s*de?\s*transaction\s*[:\-]?\s*(\d{6,})/i,
    /transaction\s*[:#]?\s*(\d{6,})/i,
    /commande\s*[:#]?\s*(\d{6,})/i,
    /référence\s*[:#]?\s*(\d{6,})/i,
    /n°\s*(\d{6,})/i,
  ];
  for (const p of patterns) {
    const m = txt.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractModele(body, subject) {
  const txt = body || subject || '';
  const patterns = [
    /article\s*[:\-]\s*([^\n\r]{5,80})/i,
    /tu as vendu\s*[:\-]?\s*([^\n\r]{5,80})/i,
    /article vendu\s*[:\-]?\s*([^\n\r]{5,80})/i,
  ];
  for (const p of patterns) {
    const m = txt.match(p);
    if (m) return m[1].trim();
  }
  const subj = (subject || '').replace(/vinted|vendu|vente|nouvelle/gi, '').trim();
  if (subj.length > 5) return subj;
  return null;
}

function extractPrice(body) {
  const patterns = [
    /(\d+[,.]?\d*)\s*€/,
    /prix\s*[:\-]?\s*(\d+[,.]?\d*)/i,
    /montant\s*[:\-]?\s*(\d+[,.]?\d*)/i,
    /total\s*[:\-]?\s*(\d+[,.]?\d*)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

function extractTaille(txt) {
  const m = txt.match(/(?:taille|pointure|t\.?|uk|eu)\s*[:\-]?\s*(\d{1,2}(?:[,. \/]\d)?)/i);
  return m ? m[1].trim() : null;
}

// ════════════════════════════════════════════════════════════
// EXTRACTEURS — ACHETEUR PRO
// (présents uniquement dans les emails de vente Vinted Pro)
// ════════════════════════════════════════════════════════════

function extractBuyerEmail(body) {
  // "Adresse e-mail : loccisanolucie@gmail.com"
  const m = body.match(/adresse\s+e-?mail\s*:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  return m ? m[1].trim() : null;
}

function extractBuyerName(body) {
  // "Adresse : Loccisano Lucie, 7 Square..." → prend tout avant la première virgule
  const m = body.match(/adresse\s*:\s*([^,\n]{3,60}),/i);
  return m ? m[1].trim() : null;
}

function extractBuyerAddress(body) {
  // "Adresse : Loccisano Lucie, 7 Square Alfred Boucher, Aix-les-Bains, 73100, FR, France"
  // On veut tout après la première virgule jusqu'à la fin de la ligne
  const m = body.match(/adresse\s*:\s*[^,\n]+,\s*(.+?)(?:\n|adresse e-?mail)/i);
  if (m) return m[1].trim().replace(/,\s*$/, '');
  // Fallback : ligne complète
  const m2 = body.match(/adresse\s*:\s*(.+)/i);
  return m2 ? m2[1].trim() : null;
}

function extractBuyerPseudo(body) {
  // "lucieloccisano a acheté"
  const m = body.match(/^([a-zA-Z0-9_\-\.]{3,40})\s+a\s+acheté/im);
  return m ? m[1].trim() : null;
}

// ════════════════════════════════════════════════════════════
// EXTRACTEURS — BORDEREAUX
// ════════════════════════════════════════════════════════════

function extractTransaction(body) {
  const m = body.match(/n°\s*de\s*transaction\s*[:\-]?\s*(\d{6,})/i);
  return m ? m[1] : extractNumero(body, '');
}

function extractSuivi(body) {
  const m = body.match(/n°\s*de\s*suivi\s*[:\-]?\s*(\d{5,})/i);
  return m ? m[1] : null;
}

function extractModeleFromBordereau(body) {
  const m = body.match(/article\s*[:\-]\s*([^\n\r]{5,100})/i);
  return m ? m[1].trim() : null;
}

function extractDateLimite(body) {
  // "À envoyer avant le : 14/07/2026 10 h 00"
  const m = body.match(/(?:à envoyer avant le|envoyer avant)\s*[:\-]?\s*(\d{1,2}\/\d{2}\/\d{4})/i);
  return m ? m[1] : null;
}

function extractTransporteur(body) {
  const b = body.toLowerCase();
  if (b.includes('mondial relay')) return 'Mondial Relay';
  if (b.includes('colissimo'))     return 'Colissimo';
  if (b.includes('chronopost'))    return 'Chronopost';
  if (b.includes('dpd'))           return 'DPD';
  if (b.includes('ups'))           return 'UPS';
  return null;
}

// ════════════════════════════════════════════════════════════
// UTILITAIRES
// ════════════════════════════════════════════════════════════

function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function fbAuthUrl(path) {
  let url = FIREBASE_URL + path + '.json';
  if (FIREBASE_SECRET) url += '?auth=' + encodeURIComponent(FIREBASE_SECRET);
  return url;
}

function firebaseGet(path) {
  try {
    const url  = fbAuthUrl(path);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  } catch (e) {
    Logger.log('firebaseGet error: ' + e);
    return null;
  }
}

function firebasePut(path, data) {
  try {
    const url = fbAuthUrl(path);
    UrlFetchApp.fetch(url, {
      method:      'put',
      contentType: 'application/json',
      payload:     JSON.stringify(data),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('firebasePut error: ' + e);
  }
}

// ── Reset labels (re-scan les anciens emails) ──
function resetLabels() {
  const label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) return;
  const threads = GmailApp.search('label:' + LABEL_NAME);
  threads.forEach(t => t.removeLabel(label));
  Logger.log('Labels réinitialisés sur ' + threads.length + ' conversations');
}
