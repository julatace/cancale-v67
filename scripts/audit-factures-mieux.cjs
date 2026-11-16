#!/usr/bin/env node
// scripts/audit-factures-mieux.cjs
// ════════════════════════════════════════════════════════════════════════════
// LOT factures-mieux (16 nov.) — Julien, captures iPhone : « tu peux améliorer les
// factures et le procédé », puis « fais les mêmes factures d'achat et améliore le
// visuel du reste ». Ce que cet audit EXÉCUTE (les vraies fonctions, données inventées) :
//   E  l'e-mail de la facture : UNE langue (jamais l'anglais puis le français empilés),
//      un récapitulatif (n°, date, article, montant = la dernière ligne du PDF, mention
//      de TVA de SON régime), les pièces jointes nommées, l'objet court, rien de VRM,
//      aucune image, aucun lien http ;
//   L  le PDF de la facture : chaque mention légale est ÉCRITE (texte relevé au dessin) ;
//   M  une vente produit la même facture par la feuille, la série et l'envoi automatique
//      (la même règle de langue) ;
//   R  le reçu d'achat généré : la forme du modèle, les accents ÉCRITS (« Reçu »,
//      « déductible »…), rien d'inventé (ni port, ni frais, ni moyen de paiement) ;
//   P  le rapport comptable : montants au format français (jamais « 11.95 »), à l'écran
//      comme dans le PDF.
//   node scripts/audit-factures-mieux.cjs            l'audit
//   node scripts/audit-factures-mieux.cjs --prouve   chaque règle réaffaiblie ⇒ rouge
//   RACINE_AUDIT=<arbre>                             juger un autre arbre (git archive)
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');

async function verifier(racine, { dire = true } = {}) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (v, quoi, detail) => { if (v) { ok++; if (dire) console.log(`✅ ${quoi}`); } else { ko++; rouges.push(quoi); if (dire) console.log(`❌ ${quoi}${detail !== undefined ? ` — ${String(detail).slice(0, 240)}` : ''}`); } };
  const imp = async (p) => { try { return await import(pathToFileURL(path.join(racine, p)).href + `?t=${Date.now()}${Math.random()}`); } catch (e) { return { __erreur: String(e && e.message || e) }; } };
  const regle = await imp('src/facturePro/regle.js');
  const pdfm = await imp('src/facturePro/pdf.js');
  const ra = await imp('src/recuAchat.js');
  const rp = await imp('src/rapportPdf.js');
  if (regle.__erreur || pdfm.__erreur) { dit(false, 'les modules de la facture se chargent', regle.__erreur || pdfm.__erreur); return { ok, ko, rouges }; }
  const PL = require(path.join(ICI, 'node_modules/pdf-lib'));
  // Un pdf-lib qui RELÈVE chaque texte posé (le vrai dessin, rien de simulé).
  const releve = [];
  const PDFLib = { ...PL, PDFDocument: { ...PL.PDFDocument, create: async (...a) => {
    const doc = await PL.PDFDocument.create(...a);
    const ajout = doc.addPage.bind(doc);
    doc.addPage = (...b) => { const page = ajout(...b); const dessine = page.drawText.bind(page); page.drawText = (t, o) => { releve.push(String(t)); return dessine(t, o); }; return page; };
    return doc;
  } } };
  const texteDe = async (fab) => { releve.length = 0; try { await fab(); } catch (e) { return `ERREUR ${e.message}`; } return releve.join('\n'); };

  const CFG = { nom: 'Atelier Banc Baskets', forme: 'EI', adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', siret: '73282932000074', email: 'atelier@banc.test', tva_regime: 'franchise', prefixe: 'FA', couleur: '#1d1d1f' };
  const V = { acheteur: { nom: 'Lou Banc', adresse: '3 Voorbeeldstraat\n1011 AB Amsterdam\nPays-Bas', email: 'lou@banc.test' }, designation: 'Paire de banc 42', centimes: 5900, venteLe: '2026-11-16T14:20:00Z', reference: '24000000001', plateforme: 'Vinted' };
  const O = { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-16T15:01:00Z') };
  const fr = regle.contenuFacture(CFG, V, O);
  const en = regle.contenuFacture(CFG, V, { ...O, langue: 'en' });

  // ── E · l'e-mail ──
  const mFr = regle.emailFacture(CFG, fr, { via: 'vrm', pieces: ['Facture-FA-2026-0006.pdf', 'Formulaire-retour.pdf'] });
  const mEn = regle.emailFacture(CFG, en, { via: 'vrm' });
  const tout = (m) => `${m.sujet}\n${m.texte}\n${m.html}`;
  const FR_MOTS = /Bonjour|Vous trouverez|Merci pour votre|N° de facture|Pièce jointe|Net à payer|Date d'émission|Date d&#39;émission/;
  const EN_MOTS = /\bHello\b|Please find|Thank you|Invoice number|Attachment|Amount due|Issue date/;
  dit(!EN_MOTS.test(tout(mFr)) && FR_MOTS.test(tout(mFr)), 'E1 facture française : l’e-mail est en français SEULEMENT (aucun mot anglais)', (tout(mFr).match(EN_MOTS) || [])[0]);
  dit(!FR_MOTS.test(tout(mEn)) && EN_MOTS.test(tout(mEn)), 'E1 facture en anglais : l’e-mail est en anglais SEULEMENT (jamais le français empilé dessous)', (tout(mEn).match(FR_MOTS) || [])[0]);
  dit(/<html lang="fr"/.test(mFr.html) && /<html lang="en"/.test(mEn.html) && mFr.langue === 'fr' && mEn.langue === 'en', 'E1 `lang` du document = la langue de l’e-mail');
  const [libTot, valTot] = regle.totalDocument(fr, 'fr');
  dit(mFr.texte.includes(`${libTot} : ${valTot}`) && mFr.html.includes('data-fm="montant"') && libTot === 'Net à payer' && valTot === regle.euros(5900), 'E2 le montant du récapitulatif = la dernière ligne du PDF (même libellé, même chiffre)', `${libTot} ${valTot}`);
  dit(mFr.texte.includes('FA-2026-0006') && mFr.texte.includes('16/11/2026') && mFr.texte.includes('Paire de banc 42'), 'E2 le récapitulatif : n°, date d’émission, article');
  dit(mFr.texte.includes(regle.MENTION_FRANCHISE) && mEn.texte.includes('VAT not applicable, article 293 B'), 'E2 la mention de TVA de SON régime (art. 293 B), dans la langue de l’e-mail');
  const marge = regle.contenuFacture({ ...CFG, tva_regime: 'marge', tva: 'FR44732829320' }, V, O);
  const norm = regle.contenuFacture({ ...CFG, tva_regime: 'normal', tva_taux: 20, tva: 'FR44732829320' }, V, O);
  dit(regle.emailFacture(CFG, marge).texte.includes(regle.MENTION_MARGE) && !/TVA \d/.test(regle.emailFacture(CFG, marge).texte), 'E2 TVA sur marge : la mention « Biens d’occasion », aucune TVA chiffrée');
  dit(/Dont TVA 20 % : 9,83/.test(regle.emailFacture(CFG, norm).texte.replace(/ /g, ' ')), 'E2 TVA classique : « Dont TVA 20 % : 9,83 € » (le montant de la facture)', regle.emailFacture(CFG, norm).texte);
  dit(/Pièces jointes : Facture-FA-2026-0006\.pdf, Formulaire-retour\.pdf/.test(mFr.texte) && /Attachment: Facture-FA-2026-0006\.pdf/.test(mEn.texte), 'E3 les pièces jointes nommées (le formulaire de retour aussi)');
  const long = regle.emailFacture({}, { ...fr, vendeur: { ...fr.vendeur, nom: 'Une boutique au nom vraiment très très long pour un objet' } });
  dit(mFr.sujet === 'Votre facture FA-2026-0006 — Atelier Banc Baskets EI' && long.sujet.length <= 60 && long.sujet.includes('FA-2026-0006'), 'E4 l’objet : « Votre facture FA-… — boutique », 60 caractères au plus, le numéro jamais coupé', long.sujet);
  dit(!/<img\b/i.test(mFr.html) && !/href="http:/.test(mFr.html) && !/>VRM</.test(mFr.html) && !/data-vv=/.test(mFr.html) && /href="mailto:atelier@banc\.test"/.test(mFr.html), 'E5 aucune image, aucun lien http, rien de VRM, aucun cadre bleu ; l’e-mail du vendeur en mailto:');
  dit(mFr.texte.includes('SIRET 732 829 320 00074') && mFr.texte.includes('1 rue du Banc'), 'E5 les coordonnées du vendeur au pied (texte brut aussi)');
  const xss = regle.emailFacture({ message: '<script>x</script> {acheteur}' }, { ...fr, acheteur: { ...fr.acheteur, nom: '<b>x</b>' } });
  dit(!/<script|<b>x/.test(xss.html), 'E6 tout est échappé');

  // ── L · le PDF porte chaque mention légale ──
  const tPdf = await texteDe(() => pdfm.pdfFacture(fr, { PDFLib }));
  const mentions = [['numéro', 'FA-2026-0006'], ["date d'émission", "Date d'émission"], ['date de la vente', 'Date de la vente'], ['vendeur avec EI', 'Atelier Banc Baskets EI'], ['adresse', '35000 Rennes'], ['SIRET', 'SIRET 732 829 320 00074'], ['acheteur', 'Lou Banc'], ['désignation', 'Paire de banc 42'], ['total', 'Net à payer'], ['art. 293 B', regle.MENTION_FRANCHISE], ['acquittée', 'acquittée'], ['nature', 'Livraison de biens']];
  const manquent = mentions.filter(([, t]) => !tPdf.includes(t)).map(([k]) => k);
  dit(!manquent.length, 'L1 le PDF ÉCRIT chaque mention obligatoire (relevé au dessin)', manquent.join(', '));
  const tEn = await texteDe(() => pdfm.pdfFacture(en, { PDFLib }));
  dit(tEn.includes(regle.MENTION_FRANCHISE) && tEn.includes('VAT not applicable') && /FACTURE \/ INVOICE/.test(tEn), 'L2 la facture en anglais reste BILINGUE (loi Toubon : le français d’abord)');

  // ── M · même facture par la feuille, la série et l'envoi automatique ──
  const lire = (p) => { try { return fs.readFileSync(path.join(racine, p), 'utf8'); } catch (_) { return ''; } };
  const jsx = lire('src/FacturePro.jsx'), api = lire('api/_lib/facture-pro.js'), auto = lire('api/_lib/factures-auto.js'), ang = lire('src/facturePro/anglais.js');
  dit(/export const langueFactureParDefaut = \(adresse\) => \(acheteurHorsFrance\(adresse\) \? 'en' : 'fr'\)/.test(ang) && /langueFactureParDefaut\(preuve\.acheteur && preuve\.acheteur\.adresse\) === 'en'/.test(jsx) && /: langueFactureParDefaut\(vente\.acheteur\.adresse\)/.test(api), 'M1 une règle de langue : la case de la feuille et le serveur (série, envoi automatique)');
  dit(!/action: 'emettre'[^}]*langue/.test(jsx.slice(jsx.indexOf('export async function envoyerFacturesSerie'))) && !/langue/.test(auto), 'M2 la série et l’envoi automatique ne forcent aucune langue (la règle du serveur s’applique)');

  // (16 nov.) La facture en PASTILLE dans la rangée N° · compte · taille, plus sous la ligne.
  dit(/facture: \(o\._fromEmail \? o\._txMail : o\.transaction_id != null\) \? <FactureVenteLigne pastille /.test(lire('src/App.jsx')) && /\{fusion\.facture \|\| null\}<\/span>/.test(lire('src/App.jsx')) && !/frise=\{<>\{\(o\._fromEmail \? o\._txMail : o\.transaction_id != null\) \? <FactureVenteLigne/.test(lire('src/App.jsx')), 'M3 sur la ligne de vente : une pastille dans la rangée du N° (plus de gros boutons sous la ligne)');
  dit(/fm\.pastille\.\$\{cle\}/.test(jsx) && /<BonRetour vente=\{vente\} preuve=\{preuve\} facture=\{facture\} deps=\{deps\} ligne=\{false\}\/>/.test(jsx), 'M3 la pastille ouvre la feuille de la facture, qui porte le bon de retour');

  // ── R · le reçu d'achat généré ──
  if (ra.__erreur) dit(false, 'R0 src/recuAchat.js se charge', ra.__erreur);
  else {
    const o = { title: 'Paire achetée de banc', price: { amount: '11.95', currency_code: 'EUR' }, date: '2026-11-14T10:47:00Z', transaction_id: 17000000001 };
    const ch = ra.champsRecuGenere(o, { account: 'compte_banc', numero: '124' });
    dit(ch.paye === 1195 && ch.lignes.length === 0 && ch.mode === '' && ch.vendeur === '—', 'R1 rien d’inventé : ni port, ni frais, ni moyen de paiement ; vendeur inconnu « — »', JSON.stringify(ch).slice(0, 200));
    dit(ra.champsRecuGenere({ ...o, price: { amount: '10', currency_code: 'GBP' } }).paye === null, 'R1 une autre devise n’est jamais convertie (« — »)');
    const tR = await texteDe(() => ra.pdfRecuAchat(ch, { PDFLib, notes: ['Achat de seconde main à un particulier : pas de TVA déductible.', 'Établi le 16/11/2026.'] }));
    dit(/REÇU D'ACHAT VINTED/.test(tR) && /Montant payé/.test(tR) && tR.includes(ra.eurosFr(11.95).replace(/[ ]/g, ' ')) && /N° de transaction/.test(tR), 'R2 la forme du modèle : « Reçu d’achat Vinted », « Montant payé », n° de transaction', tR.slice(0, 200));
    dit(/déductible/.test(tR) && /Établi le/.test(tR) && /facture émise par/.test(tR) && !/Recu|deductible|Etabli|Recapitulatif/.test(tR), 'R3 les accents sont ÉCRITS dans le PDF (« Reçu », « déductible », « Établi », « émise »)', (tR.match(/Recu|deductible|Etabli|Recapitulatif/) || [])[0]);
    dit(!/reconstruit depuis l/.test(tR), 'R4 le pied d’un reçu généré ne dit pas « reconstruit depuis l’e-mail »');
  }
  const ach = lire('src/ecrans/Achats.jsx');
  dit(/const r = recu && recu\._genere \? recu\._genere : champsRecuAchat\(recu\);/.test(ach), 'R5 l’app montre le reçu généré dans la MÊME feuille que le reçu de l’e-mail');

  // ── P · le rapport comptable au format français ──
  const app = lire('src/App.jsx');
  dit(!/montant\.toFixed\(2\)\}&nbsp;€/.test(app) && (app.match(/b\.montant==null\?'—':montant\(b\.montant, \{ centimes:'toujours' \}\)/g) || []).length === 2, 'P1 à l’écran, les achats du rapport (mois et année) au format français (montant(), jamais « 11.95 »)');
  if (rp.__erreur) dit(false, 'P2 src/rapportPdf.js se charge', rp.__erreur);
  else {
    const R = { monthLabel: 'novembre 2026', regime: 'micro', ca: 1234.5, cout: 11.95, nbCout: 1, nb: 1, frais: 0, benefNet: 1222.55, taux: 12.3, urssaf: 151.84, nAttente: 0, nMasq: 0, saleLines: [{ date: '2026-11-03T10:00:00Z', num: '1', title: 'Vente de banc 👟', sell: 1234.5, buy: 11.95, fee: 0, plateforme: 'Vinted' }], buyLines: [{ date: '2026-11-02T10:00:00Z', seller: 'vendeur_banc', title: 'Achat de banc', montant: 11.95 }], achatsTotal: 11.95 };
    const tP = await texteDe(() => rp.pdfRapport(R, { PDFLib, libelleRegime: () => 'Micro-entrepreneur' }));
    dit(!/\d\.\d{2}\b/.test(tP) && /1 234,50 €/.test(tP) && /11,95 €/.test(tP), 'P2 le PDF du rapport : « 1 234,50 € », « 11,95 € » — aucun montant à point', (tP.match(/.{0,20}\d\.\d{2}\b.{0,10}/) || [])[0]);
    dit(/finalisées/.test(tP) && !/finalisees|Benefice/.test(tP), 'P3 les accents du rapport sont écrits');
  }
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['deux langues empilées dans l’e-mail', 'src/facturePro/regle.js', "|| (langue === 'en' ? MESSAGE_DEFAUT_EN : MESSAGE_DEFAUT);", "|| (langue === 'en' ? `${MESSAGE_DEFAUT_EN}\\n\\n—\\n\\n${MESSAGE_DEFAUT}` : MESSAGE_DEFAUT);"],
  ['mention 293 B retirée du PDF', 'src/facturePro/pdf.js', '  contenu.mentions.forEach((m, i) => {', '  [].forEach((m, i) => {'],
  ['montant du récapitulatif retiré', 'src/facturePro/regle.js', '    ...(total ? [total] : []),\n  ];', '  ];'],
  ['accent perdu dans le reçu', 'src/recuAchat.js', `ecrire("REÇU D'ACHAT VINTED"`, `ecrire("RECU D'ACHAT VINTED"`],
  ['port inventé sur le reçu', 'src/recuAchat.js', '    lignes: [],', "    lignes: [{ libelle: 'Frais de port', centimes: 288 }],"],
  ['montant à point dans le rapport', 'src/rapportPdf.js', "  if (n == null || !Number.isFinite(Number(n))) return '—';\n  let t;", "  if (n == null || !Number.isFinite(Number(n))) return '—';\n  return Number(n).toFixed(2);\n  let t;"],
  ['facture revenue sous la ligne', 'src/App.jsx', '{fusion.facture || null}</span>', '</span>'],
  ['série en français forcé', 'api/_lib/facture-pro.js', ": langueFactureParDefaut(vente.acheteur.adresse);", ": 'fr';"],
];

(async () => {
  const racine = path.resolve(process.env.RACINE_AUDIT || ICI);
  if (process.argv.includes('--prouve')) {
    let vus = 0;
    for (const [nom, fichier, avant, apres] of MUTATIONS) {
      const arbre = fs.mkdtempSync(path.join(os.tmpdir(), 'factures-mieux-'));
      for (const d of ['api', 'src']) fs.cpSync(path.join(racine, d), path.join(arbre, d), { recursive: true });
      fs.copyFileSync(path.join(racine, 'package.json'), path.join(arbre, 'package.json'));
      try { fs.symlinkSync(path.join(ICI, 'node_modules'), path.join(arbre, 'node_modules')); } catch (_) {}
      const p = path.join(arbre, fichier); const src = fs.readFileSync(p, 'utf8');
      if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); fs.rmSync(arbre, { recursive: true, force: true }); continue; }
      fs.writeFileSync(p, src.replace(avant, apres));
      const r = await verifier(arbre, { dire: false });
      console.log(`${r.ko ? '✅ rouge' : '❌ VERT '} · ${nom}${r.ko ? ` (${r.rouges[0]})` : ''}`);
      if (r.ko) vus++;
      fs.rmSync(arbre, { recursive: true, force: true });
    }
    console.log(`\n${vus}/${MUTATIONS.length} mutations vues`);
    process.exit(vus === MUTATIONS.length ? 0 : 1);
  }
  const r = await verifier(racine);
  console.log(`\n${r.ok} ✅ · ${r.ko} ❌`);
  process.exit(r.ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
