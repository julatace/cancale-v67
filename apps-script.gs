// ============================================================
// === SCRIPT VINTED UNIFIÉ — Shop Cancale35 ===
// Lit les mails Vinted (ventes + finalisations), pousse les données
// directement dans l'app Firebase, sauvegarde les PDF de factures
// sur Drive, et gère les bordereaux d'envoi.
// UN SEUL FICHIER À COPIER-COLLER dans Google Apps Script.
// ============================================================

// ⚙️ RÉGLAGES
const SETTINGS = {
  companyName: 'Shop Cancale35',
  companyType: 'Entrepreneur individuel',
  companyAddress: '80 rue de la vieille rivière 35260',
  siret: '94135104100012',
  footer: 'Merci pour votre achat !',
  ccEmail: 'shopcancale35@gmail.com',
  driveFolderName: 'Factures Cancale',
  testMode: false
};

// ⚙️ URL Firebase (depuis l'app → icône nuage en haut à droite)
const FIREBASE_URL = 'https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale';

// Fallback si Firebase inaccessible
const COMPTES_VINTED_FALLBACK = [
  { id: 'acc1', nom: 'Compte 1', email: '', pseudo: '', phone: '' },
  { id: 'acc2', nom: 'Compte 2', email: '', pseudo: '', phone: '' },
];

// ============================================================
// === COMPTES : lecture depuis Firebase ===
// ============================================================

function getComptes() {
  if (!FIREBASE_URL) return COMPTES_VINTED_FALLBACK;
  try {
    const res = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_accounts.json', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return COMPTES_VINTED_FALLBACK;
    const data = JSON.parse(res.getContentText());
    if (!Array.isArray(data) || data.length === 0) return COMPTES_VINTED_FALLBACK;
    return data.map(a => ({
      id:     a.id     || '',
      nom:    a.name   || a.nom   || '',
      email:  a.email  || '',
      pseudo: a.pseudo || '',
      phone:  a.phone  || ''
    }));
  } catch (e) {
    Logger.log('⚠ getComptes Firebase : ' + e.message);
    return COMPTES_VINTED_FALLBACK;
  }
}

// Détecte le compte Vinted d'un mail — retourne {id, nom, email, ...} ou {id:'', nom:''}
function detecterCompte(msg) {
  const comptes = getComptes();

  // Méthode 1 : email iCloud dans les en-têtes bruts (transfert iCloud → Gmail)
  try {
    const raw = msg.getRawContent();
    for (const c of comptes) {
      if (c.email && raw.toLowerCase().includes(c.email.toLowerCase())) return c;
    }
  } catch (e) {}

  // Méthode 2 : alias Gmail (+slug dans le champ To)
  const to = (msg.getTo() || '').toLowerCase();
  for (const c of comptes) {
    const slug = (c.nom || '').toLowerCase().replace(/\s+/g, '');
    if (slug && to.includes('+' + slug)) return c;
  }

  // Méthode 3 : label Gmail correspondant au nom du compte
  try {
    const labels = msg.getThread().getLabels().map(l => l.getName().toLowerCase());
    for (const c of comptes) {
      const slug = (c.nom || '').toLowerCase().replace(/\s+/g, '');
      if (slug && labels.includes(slug)) return c;
    }
  } catch (e) {}

  return { id: '', nom: '' };
}

// ============================================================
// === VENTES : lecture et push vers Firebase ===
// ============================================================

// Fonction principale — à lancer manuellement ou via déclencheur
function synchroniserVinted() {
  Logger.log('🔄 Synchronisation Vinted...');
  lireMailsVinted();
  lireFinalisationsVinted();
  Logger.log('✅ Synchronisation terminée');
}

function lireMailsVinted() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Factures');

  Logger.log('🔍 Recherche des mails de vente Vinted...');

  const existingData = sheet.getDataRange().getValues();
  const existing = new Set();
  for (let i = 1; i < existingData.length; i++) {
    const row = existingData[i];
    const key = (row[4] || '') + '|' + (row[3] || '');
    if (key !== '|') existing.add(key);
  }
  Logger.log('📊 ' + existing.size + ' ventes déjà enregistrées');

  const threads = GmailApp.search('from:no-reply@vinted.fr subject:"Ton article s\'est vendu" after:2026/05/01', 0, 100);
  Logger.log('📧 ' + threads.length + ' mails de vente trouvés');

  let added = 0, skipped = 0, failed = 0;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      try {
        const data = parseVintedEmail(msg);
        if (!data) { failed++; return; }

        const key = data.pseudo + '|' + data.prix;
        if (existing.has(key)) { skipped++; return; }

        const invoiceNumber = generateInvoiceNumber(sheet);
        const saleDate = msg.getDate();
        const compte = detecterCompte(msg);

        // Enregistrement dans Sheets (suivi local)
        sheet.appendRow([
          saleDate, data.numero, data.designation, data.prix,
          data.pseudo, data.nomComplet, data.email, data.adresse, 'nouveau', compte.nom
        ]);
        existing.add(key);
        added++;
        Logger.log('💼 Compte détecté : ' + (compte.nom || '(inconnu)') + ' [' + compte.id + ']');

        // Push vers Firebase (app Cancale)
        const pushed = pushVenteFirebase(data, compte, saleDate);
        if (pushed) {
          sheet.getRange(sheet.getLastRow(), 9).setValue('sync Firebase');
          Logger.log('☁ Firebase OK pour ' + data.pseudo);
        }

        // Sauvegarde PDF sur Drive uniquement (pas d'envoi à l'acheteur)
        sauvegarderFactureDrive(data, invoiceNumber, saleDate);

        Logger.log('✓ ' + data.pseudo + ' | ' + data.designation + ' | ' + data.prix + '€');
      } catch (e) {
        Logger.log('❌ Erreur : ' + e.message);
        failed++;
      }
    });
  });

  Logger.log('✅ Ventes : ' + added + ' ajoutées, ' + skipped + ' doublons, ' + failed + ' échecs');
}

// Pousse une vente vers Firebase /vinted_sales
function pushVenteFirebase(data, compte, saleDate) {
  if (!FIREBASE_URL) return false;
  try {
    const dateStr = Utilities.formatDate(saleDate, 'Europe/Paris', 'dd/MM/yyyy');
    const uid = 'gs_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);

    const vente = {
      id:          uid,
      productId:   data.numero    || '',
      buyPrice:    0,
      sellPrice:   parseFloat(data.prix) || 0,
      saleDate:    dateStr,
      receiveDate: '',
      createdAt:   new Date().toISOString(),
      account:     compte.id      || '',
      designation: data.designation || '',
      buyerPseudo: data.pseudo    || ''
    };

    // Lecture de l'état actuel
    const res = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_sales.json', { muteHttpExceptions: true });
    let sales = [];
    if (res.getResponseCode() === 200) {
      const raw = JSON.parse(res.getContentText());
      if (Array.isArray(raw)) sales = raw;
    }

    // Dédoublonnage : même acheteur + même prix + même date
    const alreadyExists = sales.some(s =>
      s.buyerPseudo === vente.buyerPseudo &&
      String(s.sellPrice) === String(vente.sellPrice) &&
      s.saleDate === vente.saleDate
    );
    if (alreadyExists) {
      Logger.log('Firebase: doublon ignoré pour ' + data.pseudo);
      return false;
    }

    sales.push(vente);

    const putRes = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_sales.json', {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(sales),
      muteHttpExceptions: true
    });

    return putRes.getResponseCode() === 200;
  } catch (e) {
    Logger.log('⚠ Firebase push : ' + e.message);
    return false;
  }
}

// ============================================================
// === FINALISATIONS : mise à jour de receiveDate ===
// ============================================================

// Lit les mails "transaction finalisée" et met à jour receiveDate dans Firebase
function lireFinalisationsVinted() {
  if (!FIREBASE_URL) return;

  Logger.log('🔍 Recherche des mails de finalisation Vinted...');
  const threads = GmailApp.search('from:no-reply@vinted.fr subject:"transaction finalisée" after:2026/05/01', 0, 100);
  Logger.log('📧 ' + threads.length + ' mails de finalisation trouvés');

  if (threads.length === 0) return;

  // Charge toutes les ventes une seule fois
  const res = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_sales.json', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { Logger.log('⚠ Firebase inaccessible'); return; }

  let sales = JSON.parse(res.getContentText());
  if (!Array.isArray(sales)) sales = [];

  let updated = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      try {
        const body = (msg.getPlainBody() || '') + ' ' + (msg.getSubject() || '');
        const cleanBody = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

        // Pseudo de l'acheteur
        let pseudo = '';
        const pMatch = cleanBody.match(/(\S+)\s+a\s+(?:finalis|confirm)/i)
                    || cleanBody.match(/Acheteur\s*:?\s*(\S+)/i)
                    || cleanBody.match(/de\s+(\S+)\s+a\s+été\s+finalis/i);
        if (pMatch) pseudo = pMatch[1].trim();

        // Prix
        const prixMatch = cleanBody.match(/(\d+[,.]\d{2})\s*€/);
        if (!prixMatch || !pseudo) return;

        const prix = parseFloat(prixMatch[1].replace(',', '.'));
        const receiveDate = Utilities.formatDate(msg.getDate(), 'Europe/Paris', 'dd/MM/yyyy');

        let changed = false;
        sales = sales.map(s => {
          if (
            s.buyerPseudo === pseudo &&
            Math.abs(s.sellPrice - prix) < 0.01 &&
            !s.receiveDate
          ) {
            changed = true;
            updated++;
            Logger.log('✓ receiveDate = ' + receiveDate + ' pour ' + pseudo);
            return { ...s, receiveDate };
          }
          return s;
        });

        if (!changed) Logger.log('ℹ Pas de vente à matcher pour finalisation ' + pseudo + ' ' + prix + '€');
      } catch (e) {
        Logger.log('⚠ Erreur finalisation : ' + e.message);
      }
    });
  });

  if (updated > 0) {
    UrlFetchApp.fetch(FIREBASE_URL + '/vinted_sales.json', {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(sales),
      muteHttpExceptions: true
    });
    Logger.log('☁ ' + updated + ' receiveDate mis à jour dans Firebase');
  } else {
    Logger.log('ℹ Aucune mise à jour nécessaire');
  }
}

// ============================================================
// === PARSER DU MAIL DE VENTE ===
// ============================================================

function parseVintedEmail(msg) {
  let body = msg.getPlainBody() || '';

  if (body.length < 100) {
    const html = msg.getBody() || '';
    body = html.replace(/<br\s*\/?>/gi, '\n')
               .replace(/<\/p>/gi, '\n')
               .replace(/<\/div>/gi, '\n')
               .replace(/<\/li>/gi, '\n')
               .replace(/<\/td>/gi, '\t')
               .replace(/<[^>]+>/g, ' ')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&euro;/g, '€')
               .replace(/&#8364;/g, '€');
  }

  const cleanBody = body.replace(/\t/g, ' ').replace(/  +/g, ' ');
  const data = { pseudo: '', designation: '', prix: '', numero: '', nomComplet: '', adresse: '', email: '' };

  const pseudoMatch = cleanBody.match(/(\S+)\s+a\s+achet/i);
  if (pseudoMatch) data.pseudo = pseudoMatch[1].trim();

  const prixMatch = cleanBody.match(/(\d+[,.]\d{2})\s*€/);
  if (prixMatch) data.prix = prixMatch[1].replace(',', '.');

  const designMatch = cleanBody.match(/a\s+achet[éeè]\s*\n?([\s\S]+?)\s*\n?\s*\d+[,.]\d{2}\s*€/i);
  const stripBrackets = s => s.replace(/^\[.*?\]\s*/, '').trim();
  if (designMatch) data.designation = stripBrackets(designMatch[1].trim().replace(/\s+/g, ' '));
  if (!data.designation) {
    const designMatch2 = cleanBody.match(/a\s+achet[éeè]\s+(.+?)\s+\d+[,.]\d{2}\s*€/i);
    if (designMatch2) data.designation = stripBrackets(designMatch2[1].trim().replace(/\s+/g, ' '));
  }

  let numMatch = data.designation.match(/[nN][º°]?(\d{2,6})(?!\d)/);
  if (!numMatch) {
    try {
      const subj = msg.getSubject() || '';
      numMatch = subj.match(/[nN][º°]?(\d{2,6})(?!\d)/);
    } catch (e) {}
  }
  if (numMatch) {
    data.numero = numMatch[1];
    data.designation = data.designation.replace(/-?\s*[nN][º°]?\d{2,6}(?!\d)/, '').trim().replace(/\s+/g, ' ');
  }

  if (!data.numero && /^\d+\s+articles?$/i.test(data.designation)) {
    const numerosLot = extraireNumerosLot_(cleanBody);
    if (numerosLot.length > 0) {
      data.numero = numerosLot.join('+');
      Logger.log('LOT détecté : ' + data.numero);
    }
  }

  const adresseMatch = cleanBody.match(/Adresse\s*:\s*([\s\S]+?)\s*Adresse\s*e-mail/i);
  if (adresseMatch) {
    const adresseFull = adresseMatch[1].replace(/\s+/g, ' ').trim();
    const parts = adresseFull.split(',');
    if (parts.length >= 2) {
      data.nomComplet = parts[0].trim();
      data.adresse = parts.slice(1).join(',').trim();
    } else {
      data.adresse = adresseFull;
    }
  }

  const emailMatch = cleanBody.match(/Adresse\s*e-mail\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) data.email = emailMatch[1].trim();

  if (data.pseudo && data.prix) return data;
  return null;
}

// Extrait les n° de paires pour les ventes en lot
function extraireNumerosLot_(body) {
  const numeros = [];

  const sectionMatch = body.match(
    /Commande\s*[\n:]\s*([\s\S]+?)(?=\nAdresse|\ne-mail|www\.|http|Conditions|TVA|$)/i
  );
  const section = sectionMatch ? sectionMatch[1] : '';

  if (section) {
    const re = /[nN][º°]?(\d{2,6})(?!\d)/g;
    let m;
    while ((m = re.exec(section)) !== null) {
      if (!numeros.includes(m[1])) numeros.push(m[1]);
    }
  }

  if (numeros.length === 0) {
    const bas = body.length > 2000 ? body.slice(-2000) : body;
    const re2 = /[nN][º°]?(\d{2,6})(?!\d)/g;
    let m2;
    while ((m2 = re2.exec(bas)) !== null) {
      if (!numeros.includes(m2[1])) numeros.push(m2[1]);
    }
  }

  return numeros;
}

// ============================================================
// === FACTURES : numéro + PDF Drive (pas d'envoi acheteur) ===
// ============================================================

function generateInvoiceNumber(sheet) {
  const year = new Date().getFullYear();
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const d = data[i][0];
    if (d && new Date(d).getFullYear() === year) count++;
  }
  return year + '-' + String(count + 1).padStart(6, '0');
}

// Sauvegarde la facture PDF sur Drive uniquement — aucun mail envoyé à l'acheteur
function sauvegarderFactureDrive(data, invoiceNumber, saleDate) {
  try {
    const dateStr = Utilities.formatDate(saleDate, 'Europe/Paris', 'dd/MM/yyyy');
    const prix = parseFloat(data.prix).toFixed(2).replace('.', ',');

    const htmlContent = generateInvoiceHTML(data, invoiceNumber, dateStr, prix);
    const blob = Utilities.newBlob(htmlContent, 'text/html', 'temp.html');
    const safeNumero = (data.numero || 'X').replace(/\+/g, '-');
    const pdf = blob.getAs('application/pdf').setName('Facture-' + invoiceNumber + '-paire-' + safeNumero + '.pdf');

    const folders = DriveApp.getFoldersByName(SETTINGS.driveFolderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SETTINGS.driveFolderName);
    folder.createFile(pdf);
    Logger.log('📂 Facture sauvegardée sur Drive : ' + pdf.getName());
    return true;
  } catch (e) {
    Logger.log('⚠ Erreur sauvegarde Drive : ' + e.message);
    return false;
  }
}

function generateInvoiceHTML(data, invoiceNumber, dateStr, prixStr) {
  const acheteurNom = data.nomComplet || '';
  const acheteurAdr = data.adresse || '';

  const numeros = (data.numero || '').split('+').filter(Boolean);
  const numLabel = numeros.length > 1
    ? 'paires n° ' + numeros.join(' et n° ')
    : (numeros.length === 1 ? 'paire n° ' + numeros[0] : '');
  const numFooter = numeros.join(' + ') || 'N/A';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#222;max-width:800px;margin:30px auto;padding:30px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}
.logo-text{font-size:22px;font-weight:700;color:#007782;letter-spacing:1px;}
.title{text-align:right;}
.title h1{margin:0;font-size:32px;letter-spacing:1px;}
.title .num{color:#666;font-size:14px;margin-top:6px;}
.parties{display:flex;justify-content:space-between;margin-bottom:30px;gap:20px;}
.party{flex:1;}
.party-label{font-weight:700;font-size:13px;color:#666;margin-bottom:4px;}
.party-info{font-size:13px;line-height:1.5;}
.party-info b{font-size:14px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{background:#f5f5f5;text-align:left;padding:10px;font-size:13px;border-bottom:2px solid #ddd;}
th.right{text-align:right;}
td{padding:10px;font-size:13px;border-bottom:1px solid #eee;}
td.right{text-align:right;}
.totals{margin-left:auto;width:50%;}
.totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;}
.totals .total{border-top:1px solid #ccc;margin-top:6px;padding-top:8px;}
.acquittee{color:#27a85d;text-align:right;margin-top:14px;font-size:14px;font-weight:700;}
.remarques{margin-top:40px;padding-top:20px;border-top:1px solid #eee;}
.remarques .label{font-weight:700;font-size:13px;color:#666;margin-bottom:6px;}
.remarques p{margin:4px 0;font-size:13px;}
.footer{margin-top:50px;text-align:center;color:#999;font-size:10px;}
</style></head><body>
<div class="header">
  <div class="logo-text">${SETTINGS.companyName}</div>
  <div class="title">
    <h1>FACTURE</h1>
    <div class="num"># ${invoiceNumber}</div>
    <div class="num">Date : ${dateStr}</div>
  </div>
</div>
<div class="parties">
  <div class="party">
    <div class="party-label">De :</div>
    <div class="party-info"><b>${SETTINGS.companyName}</b><br>${SETTINGS.companyType}<br>${SETTINGS.companyAddress}<br>SIRET : ${SETTINGS.siret}<br><span style="color:#888">TVA non applicable, art. 293 B du CGI</span></div>
  </div>
  <div class="party" style="text-align:right">
    <div class="party-label">À :</div>
    <div class="party-info"><b>${data.email}</b>${acheteurNom ? '<br>' + acheteurNom : ''}${acheteurAdr ? '<br>' + acheteurAdr : ''}</div>
  </div>
</div>
<table>
  <thead><tr><th>Objet</th><th class="right">Quantité</th><th class="right">Prix unitaire (HT)</th><th class="right">Montant (HT)</th></tr></thead>
  <tbody><tr><td>${data.designation}</td><td class="right">${numeros.length > 1 ? numeros.length : 1}</td><td class="right">${prixStr} €</td><td class="right">${prixStr} €</td></tr></tbody>
</table>
<div class="totals">
  <div class="row"><b>Sous-total (TTC) :</b> <b>${prixStr} €</b></div>
  <div class="row total"><b>Total :</b> <b>${prixStr} €</b></div>
  <div class="row"><b>Montant payé :</b> <b>${prixStr} €</b></div>
</div>
<div class="acquittee">✓ Facture acquittée</div>
<div class="remarques">
  <div class="label">Remarques :</div>
  <p>Transaction Vinted${numLabel ? ' - ' + numLabel : ''}</p>
  <p>${SETTINGS.footer}</p>
</div>
<div class="footer">N° d'étiquetage : ${numFooter}</div>
</body></html>`;
}

// ============================================================
// === API WEB (doGet) ===
// ============================================================

function doGet(e) {
  const type = (e && e.parameter && e.parameter.type) ? e.parameter.type : 'factures';

  if (type === 'fusion') {
    const idsParam = (e && e.parameter && e.parameter.ids) ? String(e.parameter.ids) : '';
    const transactions = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : null;
    let url = null, erreur = null;
    try {
      url = _fusionnerBordereaux_(transactions);
    } catch (err) {
      erreur = String(err);
    }
    if (url) {
      const idMatch = url.match(/[-\w]{25,}/);
      const viewUrl = idMatch ? ('https://drive.google.com/file/d/' + idMatch[0] + '/view') : url;
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<meta http-equiv="refresh" content="0; url=' + viewUrl + '">'
        + '<title>Bordereaux</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;">'
        + '<p>Ouverture du PDF fusionné...</p>'
        + '<p><a href="' + viewUrl + '">Touche ici si rien ne s\'ouvre</a></p>'
        + '</body></html>';
      return HtmlService.createHtmlOutput(html)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    const htmlErr = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
      + '<body style="font-family:sans-serif;text-align:center;padding:40px;">'
      + '<p>Aucun bordereau à fusionner' + (erreur ? (' (' + erreur + ')') : '') + '.</p>'
      + '</body></html>';
    return HtmlService.createHtmlOutput(htmlErr);
  }

  const sheetName = (type === 'bordereaux') ? 'Bordereaux' : 'Factures';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// === BORDEREAUX ===
// ============================================================

const BORD_SETTINGS = {
  driveFolderName: 'Bordereaux à imprimer',
  sheetName: 'Bordereaux'
};

// Pousse un bordereau vers Firebase /vinted_bordereaux (lecture dans l'app)
function pushBordeauFirebase(data, pdfUrl) {
  if (!FIREBASE_URL) return false;
  try {
    const uid = 'bord_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    const bord = {
      id:          uid,
      date:        Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy'),
      numero:      data.numero      || '',
      modele:      data.modele      || '',
      taille:      data.taille      || '',
      suivi:       data.suivi       || '',
      transaction: data.transaction || '',
      dateLimite:  data.dateLimite  || '',
      pdfUrl:      pdfUrl           || '',
      statut:      'à imprimer'
    };

    const res = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_bordereaux.json', { muteHttpExceptions: true });
    let bords = [];
    if (res.getResponseCode() === 200) {
      const raw = JSON.parse(res.getContentText());
      if (Array.isArray(raw)) bords = raw;
    }

    const alreadyExists = bords.some(b => b.transaction && b.transaction === bord.transaction);
    if (alreadyExists) { Logger.log('Firebase bordereau: doublon ignoré ' + bord.transaction); return false; }

    bords.push(bord);
    const putRes = UrlFetchApp.fetch(FIREBASE_URL + '/vinted_bordereaux.json', {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(bords),
      muteHttpExceptions: true
    });
    return putRes.getResponseCode() === 200;
  } catch (e) {
    Logger.log('⚠ Firebase bordereau push : ' + e.message);
    return false;
  }
}

function lireBordereauxVinted() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BORD_SETTINGS.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(BORD_SETTINGS.sheetName);
    sheet.appendRow(['Date mail', 'N° paire', 'Modèle', 'Taille', 'N° suivi', 'N° transaction', 'Date limite', 'Statut', 'Lien PDF']);
  }

  Logger.log('🔍 Recherche des mails bordereaux...');

  const existingData = sheet.getDataRange().getValues();
  const existing = new Set();
  for (let i = 1; i < existingData.length; i++) {
    const trans = existingData[i][4];
    if (trans) existing.add(String(trans).trim());
  }
  Logger.log('📊 ' + existing.size + ' bordereaux déjà traités');

  const threads = GmailApp.search('from:vinted subject:"Bordereau d\'envoi" after:2026/05/01', 0, 50);
  Logger.log('📧 ' + threads.length + ' mails bordereaux trouvés');

  let added = 0, skipped = 0, failed = 0;
  const debut = Date.now();
  const LIMITE_MS = 5 * 60 * 1000;
  let stop = false;

  threads.forEach(thread => {
    if (stop) return;
    thread.getMessages().forEach(msg => {
      if (stop) return;
      if (Date.now() - debut > LIMITE_MS) {
        Logger.log('⏸ Limite de temps atteinte, relance le script pour traiter le reste.');
        stop = true;
        return;
      }
      try {
        const data = parseBordereauEmail(msg);
        if (!data) { failed++; return; }
        if (existing.has(data.transaction)) { skipped++; return; }

        const attachments = msg.getAttachments();
        let pdfBlob = null;
        for (const att of attachments) {
          if (att.getContentType() === 'application/pdf' || /\.pdf$/i.test(att.getName())) {
            pdfBlob = att.copyBlob(); break;
          }
        }
        if (!pdfBlob) { Logger.log('⚠ Pas de PDF'); failed++; return; }

        let finalPdf;
        try {
          finalPdf = ecrireSurBordereauSlides(pdfBlob, data.numero, data.modele, data.taille, data.dateLimite);
        } catch (e) {
          Logger.log('⚠ Écriture échouée, PDF original conservé : ' + e.message);
          finalPdf = pdfBlob;
        }

        const safeModele = (data.modele || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
        const safeTaille = data.taille ? ' T' + data.taille : '';
        const fileName = (data.numero || 'sans-numero') + (safeModele ? ' - ' + safeModele : '') + safeTaille + '.pdf';
        finalPdf.setName(fileName);

        let folder;
        const folders = DriveApp.getFoldersByName(BORD_SETTINGS.driveFolderName);
        folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BORD_SETTINGS.driveFolderName);
        const file = folder.createFile(finalPdf);
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
        const pdfUrl = file.getUrl();

        sheet.appendRow([
          msg.getDate(), data.numero, data.modele, data.taille || '', data.suivi,
          data.transaction, data.dateLimite, 'à imprimer', pdfUrl
        ]);

        // Push dans Firebase pour lecture dans l'app Cancale
        const pushed = pushBordeauFirebase(data, pdfUrl);
        if (pushed) Logger.log('☁ Bordereau Firebase OK : ' + data.numero);
        existing.add(data.transaction);
        added++;
        Logger.log('✓ Bordereau paire ' + data.numero + ' | ' + data.modele);
      } catch (e) {
        Logger.log('❌ Erreur : ' + e.message);
        failed++;
      }
    });
  });

  Logger.log('✅ Terminé : ' + added + ' ajoutés, ' + skipped + ' doublons, ' + failed + ' échecs');
}

function diagnostiquerBordereau() {
  const threads = GmailApp.search('from:vinted subject:"Bordereau d\'envoi" after:2026/05/01', 0, 1);
  if (threads.length === 0) { Logger.log('Aucun mail bordereau trouvé.'); return; }
  const msg = threads[0].getMessages()[0];
  const body = msg.getPlainBody() || '';
  Logger.log('=== SUJET ===');
  Logger.log(msg.getSubject());
  Logger.log('=== CORPS (plain, 1500 premiers caractères) ===');
  Logger.log(body.slice(0, 1500));
  Logger.log('=== PIÈCES JOINTES ===');
  msg.getAttachments().forEach(a => Logger.log(a.getName() + ' (' + a.getContentType() + ')'));
  Logger.log('=== RÉSULTAT DU PARSER ===');
  const data = parseBordereauEmail(msg);
  Logger.log(data ? JSON.stringify(data) : 'NULL (échec extraction)');
}

function parseBordereauEmail(msg) {
  const subject = msg.getSubject() || '';
  let body = msg.getPlainBody() || '';
  const html = msg.getBody() || '';
  const htmlText = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
             .replace(/<\/div>/gi, '\n').replace(/<\/td>/gi, ' ').replace(/<\/tr>/gi, '\n')
             .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&#\d+;/g, ' ');
  let attachNames = '';
  try { msg.getAttachments().forEach(a => { attachNames += ' ' + a.getName(); }); } catch (e) {}

  const all = (subject + '\n' + body + '\n' + htmlText + '\n' + attachNames)
              .replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ');

  const data = { article: '', modele: '', numero: '', taille: '', suivi: '', transaction: '', dateLimite: '' };

  let art = subject.match(/pour\s+(.+?)\s*$/i);
  if (!art) art = all.match(/Article\s*:?\s*([^\n]+?)\s*(?:Format|N[°ºo]?\s*de|\n)/i);
  if (art) data.article = art[1].trim().replace(/\s+/g, ' ');
  if (data.article) {
    const numMatch = data.article.match(/[nN][º°]?(\d{2,6})(?!\d)/);
    if (numMatch) {
      data.numero = numMatch[1];
      data.modele = data.article.replace(/-?\s*[nN][º°]?\d{2,6}(?!\d)/, '').trim().replace(/\s+/g, ' ');
    } else { data.modele = data.article; }
  }

  // Taille : "Taille 42", "T.42", "T42", "42 EU", "42 FR"
  const taillePatterns = [
    /(?:Taille|T\.?|Size)\s*(\d{2,3}(?:[.,]\d)?)\b/i,
    /\b(\d{2,3}(?:[.,]\d)?)\s*(?:EU|FR|US|UK)\b/i
  ];
  for (const pat of taillePatterns) {
    const tm = (data.article || '').match(pat);
    if (tm) { data.taille = tm[1]; break; }
  }

  let trans = attachNames.match(/Bordereau[- ]Vinted[- ](\d{6,})/i);
  if (!trans) trans = all.match(/N[°ºo]?\s*de\s*transaction\s*:?\s*(\d{6,})/i);
  if (!trans) trans = all.match(/transaction\s*:?\s*(\d{8,})/i);
  if (trans) data.transaction = trans[1].trim();

  let suivi = all.match(/N[°ºo]?\s*de\s*suivi\s*:?\s*([A-Z]{2}[A-Z0-9]{6,})/i);
  if (!suivi) suivi = all.match(/suivi\s*:?\s*([A-Z]{2}[A-Z0-9]{6,})/i);
  if (suivi) data.suivi = suivi[1].trim();

  let date = all.match(/avant\s*le\s*:?\s*(\d{2}\/\d{2}\/\d{4}[\s\dh:]*?)(?:\s*pour|\n|$)/i);
  if (date) data.dateLimite = date[1].trim().replace(/\s+/g, ' ');

  if (data.transaction) return data;
  return null;
}

function ecrireSurBordereauSlides(pdfBlob, numero, modele, taille, dateLimite) {
  const tmpFolder = getTempFolder_();
  const tmpPdf = tmpFolder.createFile(pdfBlob.setName('tmp_bord_' + Date.now() + '.pdf'));

  let imgBlob;
  try {
    imgBlob = renderPdfFirstPageToImage_(tmpPdf.getId());
  } catch (e) {
    tmpPdf.setTrashed(true);
    throw new Error('Conversion image impossible : ' + e.message);
  }

  let imgW = 1600, imgH = 1131;
  try {
    const bytes = imgBlob.getBytes();
    const w = ((bytes[16] & 0xff) << 24) | ((bytes[17] & 0xff) << 16) | ((bytes[18] & 0xff) << 8) | (bytes[19] & 0xff);
    const h = ((bytes[20] & 0xff) << 24) | ((bytes[21] & 0xff) << 16) | ((bytes[22] & 0xff) << 8) | (bytes[23] & 0xff);
    if (w > 0 && h > 0) { imgW = w; imgH = h; }
  } catch (e) {}

  const pres = SlidesApp.create('tmp_bordereau_' + Date.now());
  const presId = pres.getId();
  const presFile = DriveApp.getFileById(presId);

  const slide2 = pres.getSlides()[0];
  slide2.getPageElements().forEach(el => el.remove());

  const PAGE_W = 720, PAGE_H = 405;
  const BANDE_H = 28;
  const zoneH = PAGE_H - BANDE_H;

  const ratio = imgW / imgH;
  let drawW = PAGE_W, drawH = PAGE_W / ratio;
  if (drawH > zoneH) { drawH = zoneH; drawW = zoneH * ratio; }
  const offX = (PAGE_W - drawW) / 2;
  const offY = (zoneH - drawH) / 2;
  slide2.insertImage(imgBlob, offX, offY, drawW, drawH);

  const aLeNumero = numero && String(numero).trim() !== '' && String(numero).trim() !== '?';
  const mod = String(modele || '').trim();
  const tail = taille ? '  T.' + String(taille).trim() : '';
  let texte;
  if (aLeNumero && mod) texte = 'No ' + String(numero).trim() + '  -  ' + mod + tail;
  else if (aLeNumero)   texte = 'No ' + String(numero).trim() + tail;
  else                  texte = mod + tail || 'sans numero';
  Logger.log('Bordereau -> texte écrit : "' + texte + '"');

  const boxX = 6, boxY = PAGE_H - BANDE_H + 2, boxW = PAGE_W - 12, boxH = BANDE_H - 6;

  const rect = slide2.insertShape(SlidesApp.ShapeType.RECTANGLE, boxX, boxY, boxW, boxH);
  rect.getFill().setSolidFill('#FFFFFF');
  rect.getBorder().getLineFill().setSolidFill('#000000');
  rect.getBorder().setWeight(1);

  const txt = rect.getText();
  txt.setText(texte);
  const taille = texte.length > 45 ? 9 : (texte.length > 30 ? 11 : 13);
  txt.getTextStyle().setBold(true).setFontSize(taille);
  txt.getParagraphs().forEach(p => p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER));

  pres.saveAndClose();

  const exportUrl = 'https://docs.google.com/presentation/d/' + presId + '/export/pdf';
  const token = ScriptApp.getOAuthToken();
  const pdfResp = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: 'Bearer ' + token } });
  const finalPdf = pdfResp.getBlob().setName('bordereau.pdf');

  try { tmpPdf.setTrashed(true); } catch (e) {}
  try { presFile.setTrashed(true); } catch (e) {}

  return finalPdf;
}

function renderPdfFirstPageToImage_(fileId) {
  const token = ScriptApp.getOAuthToken();
  let thumbnailLink = null;
  for (let essai = 0; essai < 6; essai++) {
    try {
      const meta = JSON.parse(UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
      ).getContentText());
      if (meta.thumbnailLink) { thumbnailLink = meta.thumbnailLink; break; }
    } catch (e) {}
    Utilities.sleep(2000);
  }
  if (!thumbnailLink) throw new Error('thumbnailLink indisponible après plusieurs essais');
  const bigUrl = thumbnailLink.replace(/=s\d+$/, '=s1600');
  const imgResp = UrlFetchApp.fetch(bigUrl, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (imgResp.getResponseCode() !== 200) throw new Error('Téléchargement image échoué (' + imgResp.getResponseCode() + ')');
  return imgResp.getBlob().setName('bordereau.png');
}

function getTempFolder_() {
  const name = '_tmp_cancale';
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

// ============================================================
// === FUSION DES BORDEREAUX EN UN SEUL PDF ===
// ============================================================

function fusionnerBordereauxAImprimer() {
  return _fusionnerBordereaux_(null);
}

const FUSION_DATE_DEPART = '2026-05-26';

function _fusionnerBordereaux_(transactions) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BORD_SETTINGS.sheetName);
  if (!sheet) { Logger.log('❌ Feuille Bordereaux introuvable'); return null; }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxLien   = headers.indexOf('Lien PDF');
  const idxStatut = headers.indexOf('Statut');
  const idxTrans  = headers.indexOf('N° transaction');
  const idxNum    = headers.indexOf('N° paire');
  const idxMod    = headers.indexOf('Modèle');
  const idxDate   = headers.indexOf('Date mail');
  if (idxLien < 0) { Logger.log('❌ Colonne "Lien PDF" introuvable'); return null; }

  const dateDepart = new Date(FUSION_DATE_DEPART + 'T00:00:00');
  const filtreTrans = (transactions && transactions.length) ? new Set(transactions.map(String)) : null;

  const aFusionner = [];
  for (let i = 1; i < data.length; i++) {
    const lien   = String(data[i][idxLien]   || '').trim();
    if (!lien) continue;
    const statut = String(data[i][idxStatut] || '').trim();
    const trans  = String(data[i][idxTrans]  || '').trim();

    let dateBord = null;
    if (idxDate >= 0) {
      const v = data[i][idxDate];
      dateBord = (v instanceof Date) ? v : new Date(String(v));
      if (isNaN(dateBord.getTime())) dateBord = null;
    }

    if (filtreTrans) {
      if (!filtreTrans.has(trans)) continue;
    } else {
      if (statut && statut !== 'à imprimer') continue;
      if (dateBord && dateBord < dateDepart) continue;
    }
    aFusionner.push({
      lien:  lien,
      num:   String(data[i][idxNum] || '').trim(),
      mod:   idxMod >= 0 ? String(data[i][idxMod] || '').trim() : '',
      trans: trans,
      date:  dateBord
    });
  }

  aFusionner.sort((a, b) => {
    const ta = a.date ? a.date.getTime() : 0;
    const tb = b.date ? b.date.getTime() : 0;
    return tb - ta;
  });

  if (aFusionner.length === 0) { Logger.log('⚠ Aucun bordereau à fusionner'); return null; }
  Logger.log('Fusion de ' + aFusionner.length + ' bordereau(x)...');

  const pres = SlidesApp.create('FUSION temporaire ' + new Date().getTime());
  const presId = pres.getId();
  const PAGE_W = 720, PAGE_H = 405;

  let ok = 0;
  for (let k = 0; k < aFusionner.length; k++) {
    try {
      const id = (aFusionner[k].lien.match(/[-\w]{25,}/) || [])[0];
      if (!id) { Logger.log('⚠ ID introuvable : ' + aFusionner[k].lien); continue; }
      const imgBlob = renderPdfFirstPageToImage_(id);
      const b = imgBlob.getBytes();
      const imgW = ((b[16] & 0xff) << 24) | ((b[17] & 0xff) << 16) | ((b[18] & 0xff) << 8) | (b[19] & 0xff);
      const imgH = ((b[20] & 0xff) << 24) | ((b[21] & 0xff) << 16) | ((b[22] & 0xff) << 8) | (b[23] & 0xff);
      const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
      const ratio = imgW / imgH;
      let drawW = PAGE_W, drawH = PAGE_W / ratio;
      if (drawH > PAGE_H) { drawH = PAGE_H; drawW = PAGE_H * ratio; }
      const offX = (PAGE_W - drawW) / 2, offY = (PAGE_H - drawH) / 2;
      slide.insertImage(imgBlob, offX, offY, drawW, drawH);
      ok++;
      Logger.log('  + ' + (aFusionner[k].num || aFusionner[k].trans) + ' ajouté');
    } catch (err) {
      Logger.log('  ⚠ Erreur sur un bordereau : ' + err);
    }
  }

  try {
    const slides = pres.getSlides();
    if (slides.length > ok && ok > 0) slides[0].remove();
  } catch (e) {}

  pres.saveAndClose();

  if (ok === 0) {
    Logger.log('❌ Aucun bordereau n\'a pu être ajouté');
    try { DriveApp.getFileById(presId).setTrashed(true); } catch (e) {}
    return null;
  }

  const token = ScriptApp.getOAuthToken();
  const exp = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + presId + '/export?mimeType=application/pdf',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
  );
  if (exp.getResponseCode() !== 200) {
    Logger.log('❌ Export PDF échoué (' + exp.getResponseCode() + ')');
    return null;
  }
  const nom = 'FUSION-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmm') + '.pdf';
  const folders = DriveApp.getFoldersByName(BORD_SETTINGS.driveFolderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BORD_SETTINGS.driveFolderName);
  const file = folder.createFile(exp.getBlob().setName(nom));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  try { DriveApp.getFileById(presId).setTrashed(true); } catch (e) {}

  const url = file.getUrl();
  Logger.log('✅ PDF fusionné créé : ' + nom + ' (' + ok + ' page(s))');
  Logger.log('📄 Ouvre-le ici : ' + url);
  Logger.log('(Il est aussi dans ton dossier Drive "' + BORD_SETTINGS.driveFolderName + '")');
  return url;
}
