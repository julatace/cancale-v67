/**
 * ============================================================
 *  CANCALE SHOES STORE — Synchro Factures + Bordereaux → Firebase
 * ============================================================
 *
 *  Remplace l'ancien script Supabase.
 *  À AJOUTER dans le MÊME projet Apps Script que apps-script.gs.
 *  Installer un déclencheur sur "synchroniserToutFirebase"
 *  (toutes les 15 min par ex.).
 * ============================================================
 */

const FIREBASE_DB_URL = "https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale.json";

/**
 * Fonction principale : à mettre en déclencheur toutes les 15 min.
 */
function synchroniserToutFirebase() {
  const cloud = fbGetData();
  let change = false;

  const invoices = Array.isArray(cloud.vinted_invoices) ? cloud.vinted_invoices : [];
  const ajoutFactures = synchroFactures(invoices);
  if (ajoutFactures > 0) { cloud.vinted_invoices = invoices; change = true; }

  const bordereaux = Array.isArray(cloud.vinted_bordereaux) ? cloud.vinted_bordereaux : [];
  const ajoutBordereaux = synchroBordereaux(bordereaux);
  if (ajoutBordereaux > 0) { cloud.vinted_bordereaux = bordereaux; change = true; }

  if (change) {
    fbPatchData({ vinted_invoices: cloud.vinted_invoices, vinted_bordereaux: cloud.vinted_bordereaux });
    Logger.log("Firebase mis à jour : " + ajoutFactures + " facture(s), " + ajoutBordereaux + " bordereau(x).");
  } else {
    Logger.log("Rien de nouveau à synchroniser.");
  }
}

/**
 * DIAGNOSTIC : vérifie l'accès aux feuilles et à Firebase.
 */
function diagnostiquerFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) { Logger.log('❌ Pas de feuille active.'); return; }
  Logger.log('✅ Feuille : ' + ss.getName());

  const fact = ss.getSheetByName('Factures');
  Logger.log('Factures : ' + (fact ? fact.getLastRow() + ' lignes' : 'INTROUVABLE'));

  const bord = ss.getSheetByName('Bordereaux');
  Logger.log('Bordereaux : ' + (bord ? bord.getLastRow() + ' lignes' : 'INTROUVABLE'));

  const data = fbGetData();
  Logger.log('Firebase — factures : ' + (Array.isArray(data.vinted_invoices) ? data.vinted_invoices.length : 0));
  Logger.log('Firebase — bordereaux : ' + (Array.isArray(data.vinted_bordereaux) ? data.vinted_bordereaux.length : 0));
}

/**
 * TEST : simule sans écrire dans Firebase.
 */
function testerSynchroFirebase() {
  const cloud = fbGetData();
  const invoices = Array.isArray(cloud.vinted_invoices) ? cloud.vinted_invoices.slice() : [];
  const bordereaux = Array.isArray(cloud.vinted_bordereaux) ? cloud.vinted_bordereaux.slice() : [];
  const f = synchroFactures(invoices);
  const b = synchroBordereaux(bordereaux);
  Logger.log("TEST (rien écrit) → " + f + " facture(s) et " + b + " bordereau(x) seraient ajoutés.");
}

/* ============================================================
 *  Fonctions Firebase REST
 * ============================================================ */

function fbGetData() {
  try {
    const res = UrlFetchApp.fetch(FIREBASE_DB_URL, {
      method: "get",
      muteHttpExceptions: true,
    });
    const data = JSON.parse(res.getContentText());
    return data || {};
  } catch (e) {
    Logger.log("Erreur lecture Firebase : " + e);
    return {};
  }
}

function fbPatchData(data) {
  try {
    const res = UrlFetchApp.fetch(FIREBASE_DB_URL, {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    Logger.log("Firebase PATCH : code " + code + (code >= 200 && code < 300 ? " ✅" : " ❌"));
  } catch (e) {
    Logger.log("Erreur écriture Firebase : " + e);
  }
}

/* ============================================================
 *  synchroFactures et synchroBordereaux
 *  (identiques à l'ancien script, réutilisés ici)
 * ============================================================ */

function synchroFactures(invoices) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Factures');
  if (!sheet) { Logger.log("Onglet Factures introuvable."); return 0; }

  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return 0;

  let start = 0;
  const first = values[0].map(c => String(c).toLowerCase());
  if (first.some(c => c.indexOf('pseudo') >= 0 || c.indexOf('désignation') >= 0 || c.indexOf('designation') >= 0)) {
    start = 1;
  }

  const vus = {};
  invoices.forEach(i => { vus[String(i.productId) + '|' + String(i.sellPrice) + '|' + String(i.buyerName)] = true; });

  const annee = new Date().getFullYear();
  let maxNum = 0;
  invoices.forEach(i => {
    if (i.number && String(i.number).indexOf(annee + '-') === 0) {
      const n = parseInt(String(i.number).split('-')[1], 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  });

  let ajouts = 0;
  for (let r = start; r < values.length; r++) {
    const row = values[r];
    const saleDate    = row[0];
    const numero      = String(row[1] || '').trim();
    const designation = String(row[2] || '').trim();
    const prix        = row[3];
    const pseudo      = String(row[4] || '').trim();
    const nomComplet  = String(row[5] || '').trim();
    const email       = String(row[6] || '').trim();
    const adresse     = String(row[7] || '').trim();

    if (!pseudo || prix === '' || prix == null) continue;

    const key = numero + '|' + String(prix) + '|' + nomComplet;
    if (vus[key]) continue;

    maxNum += 1;
    const numFacture = annee + '-' + String(maxNum).padStart(6, '0');

    let dateIso = '';
    try {
      if (saleDate instanceof Date) dateIso = Utilities.formatDate(saleDate, "Europe/Paris", "yyyy-MM-dd");
      else if (saleDate) dateIso = String(saleDate);
    } catch (e) {}

    invoices.unshift({
      id: 'inv_sheet_' + new Date().getTime() + '_' + Math.floor(Math.random() * 100000),
      number: numFacture,
      productId: numero,
      itemName: designation,
      sellPrice: String(prix),
      saleDate: dateIso,
      buyerName: nomComplet,
      buyerEmail: email,
      buyerAddress: adresse,
      vintedNumber: '',
      source: 'auto',
      validated: false,
      pseudo: pseudo,
      createdAt: new Date().toISOString(),
    });
    vus[key] = true;
    ajouts++;
  }
  if (ajouts > 0) Logger.log(ajouts + " facture(s) ajoutée(s).");
  return ajouts;
}

function synchroBordereaux(bordereaux) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bordereaux');
  if (!sheet) { Logger.log("Onglet Bordereaux introuvable."); return 0; }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  const head = values[0].map(c => String(c).trim());
  const col = (nom) => head.indexOf(nom);
  const iDate = col('Date mail'), iPaire = col('N° paire'), iModele = col('Modèle'),
        iSuivi = col('N° suivi'), iTx = col('N° transaction'),
        iLimite = col('Date limite'), iStatut = col('Statut'), iPdf = col('Lien PDF');

  const vus = {};
  bordereaux.forEach(b => { if (b.transaction) vus[String(b.transaction)] = true; });

  let ajouts = 0;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const transaction = String(iTx >= 0 ? row[iTx] : '').trim();
    if (!transaction || vus[transaction]) continue;

    let dateMail = '';
    try {
      const dv = iDate >= 0 ? row[iDate] : '';
      if (dv instanceof Date) dateMail = Utilities.formatDate(dv, "Europe/Paris", "dd/MM/yyyy");
      else if (dv) dateMail = String(dv);
    } catch (e) {}

    bordereaux.unshift({
      id: 'bord_' + transaction,
      numero: String(iPaire >= 0 ? row[iPaire] : '').trim(),
      modele: String(iModele >= 0 ? row[iModele] : '').trim(),
      suivi: String(iSuivi >= 0 ? row[iSuivi] : '').trim(),
      transaction: transaction,
      dateLimite: String(iLimite >= 0 ? row[iLimite] : '').trim(),
      statut: String(iStatut >= 0 ? row[iStatut] : 'à imprimer').trim() || 'à imprimer',
      pdfUrl: String(iPdf >= 0 ? row[iPdf] : '').trim(),
      dateMail: dateMail,
    });
    vus[transaction] = true;
    ajouts++;
  }
  if (ajouts > 0) Logger.log(ajouts + " bordereau(x) ajouté(s).");
  return ajouts;
}
