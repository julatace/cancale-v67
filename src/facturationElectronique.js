// ════════════════════════════════════════════════════════════════════════════
//  FACTURATION ÉLECTRONIQUE — ce que VRM PRÉPARE, gratuitement (16 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Réforme française : les micro-entreprises devront émettre leurs factures B2B
// en électronique et transmettre les données de leurs ventes aux particuliers
// (e-reporting), via une plateforme agréée. VRM ne se connecte à AUCUNE
// plateforme (payante ou non) : il prépare deux fichiers que le vendeur envoie
// lui-même depuis la sienne.
//   1. une facture Factur-X (PDF + XML CII profil BASIC WL embarqué,
//      `factur-x.xml`) depuis UNE vente ;
//   2. un récapitulatif mensuel des ventes (CSV + JSON).
//
// Règles (CLAUDE.md) :
//   · aucune donnée inventée : un profil incomplet, un régime non renseigné ou
//     non pris en charge ⇒ PAS de facture, et la raison + le geste ;
//   · aucune règle de vente n'est écrite ici : les lignes viennent de
//     `ventesDeclarables` (App.jsx), datées au versement ;
//   · un total partiel se dit « au moins », avec ce qui manque — à l'écran ET
//     dans le fichier ;
//   · toute valeur qui vient d'un acheteur (nom, titre) est échappée dans le
//     XML ; dans le PDF elle est écrite comme du texte (pdf-lib n'interprète
//     rien), nettoyée de ce que la police standard ne sait pas dessiner.
// Module PUR (hors `pdfFacturX`, qui charge pdf-lib) : exécutable par un banc.

export const MENTION_293B = 'TVA non applicable, art. 293 B du CGI';
export const PROFIL_FX = 'BASIC WL';
export const GUIDELINE_BASICWL = 'urn:factur-x.eu:1p0:basicwl';
export const ACHETEUR_DEFAUT = 'Particulier';

export const xmlEchappe = (s) => String(s == null ? '' : s)
  // Un caractère de contrôle est INTERDIT en XML 1.0 (le fichier deviendrait
  // mal formé) : retiré, jamais recopié.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// Centimes entiers : jamais de somme de flottants (0,1 + 0,2).
export const centimesDe = (eur) => { const n = Number(eur); return isFinite(n) ? Math.round(n * 100) : NaN; };
export const eurDe = (c) => (c / 100).toFixed(2);

const pad = (n) => String(n).padStart(2, '0');
// Date locale de l'appareil (comme le reste de l'app) : AAAAMMJJ / AAAA-MM-JJ.
export const ymd = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
export const isoJour = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const frJour = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

// ── PEUT-ON FACTURER ? ──────────────────────────────────────────────────────
// `cfg` = la ligne `vrm_pro_facture` en trois états (undefined en cours · null
// pas su · objet lu) ; `regime` = `vinted_regime` BRUT (null s'il n'a jamais
// été choisi : on ne retombe PAS sur « micro ») ; `verifier` = `verifierSiren`
// de l'app (une seule règle de SIREN, §11).
// Rend { ok, etat, raison, geste, vendeur? }.
export const etatFacturation = ({ cfg, regime, verifier }) => {
  if (cfg === undefined) return { ok: false, etat: 'encours', raison: 'Je lis ton profil fiscal…', geste: '' };
  if (cfg === null) return { ok: false, etat: 'passu', raison: "Ton profil fiscal n'a pas pu être lu (la base n'a pas répondu).", geste: 'Rouvre cet écran dans un moment : aucune facture ne part sur un profil que je n\'ai pas lu.' };
  if (regime == null || regime === '') return { ok: false, etat: 'regime', raison: "Ton régime fiscal n'est pas renseigné : je ne sais pas quelle mention de TVA écrire.", geste: 'Choisis-le dans « Profil fiscal », plus haut sur cette page.' };
  if (regime === 'marge') return { ok: false, etat: 'regime', raison: "Le régime de la marge n'est pas encore pris en charge par cette facture (sa mention de TVA est différente).", geste: 'Émets-la depuis ta plateforme agréée, ou vois-la avec ton comptable.' };
  if (regime !== 'micro') return { ok: false, etat: 'regime', raison: 'Régime fiscal inconnu.', geste: 'Choisis-le dans « Profil fiscal ».' };
  if (String(cfg.tva || '').trim()) return { ok: false, etat: 'tva', raison: "Un n° de TVA est renseigné : tu es assujetti, la mention « art. 293 B » ne s'applique pas et VRM ne sait pas encore faire une facture avec TVA.", geste: 'Si tu es en franchise de TVA, vide le champ « N° TVA » de ton profil fiscal.' };
  const s = typeof verifier === 'function' ? verifier(cfg.siret) : { etat: 'invalide', raison: 'vérification indisponible' };
  if (s.etat === 'vide') return { ok: false, etat: 'siren', raison: 'Ton SIREN est absent : une facture doit le porter.', geste: 'Renseigne-le dans « Profil fiscal » (9 chiffres, sur ton avis de situation INSEE).' };
  if (s.etat !== 'ok') return { ok: false, etat: 'siren', raison: `Ton SIREN ne semble pas valide (${s.raison || 'clé de contrôle'}).`, geste: 'Corrige-le dans « Profil fiscal ».' };
  const nom = String(cfg.nom || '').trim();
  if (!nom) return { ok: false, etat: 'nom', raison: 'Ta raison sociale (ou ton nom) est vide.', geste: 'Renseigne-la dans « Profil fiscal ».' };
  const manque = [['adresse', "l'adresse"], ['codePostal', 'le code postal'], ['ville', 'la ville']].filter(([k]) => !String(cfg[k] || '').trim()).map(([, l]) => l);
  if (manque.length) return { ok: false, etat: 'adresse', raison: `Ton adresse est incomplète (${manque.join(', ')}) : une facture doit la porter.`, geste: 'Complète-la dans « Profil fiscal ».' };
  return {
    ok: true, etat: 'ok', raison: '', geste: '',
    vendeur: { nom, siren: s.siren, siret: String(cfg.siret || '').replace(/[\s.-]/g, ''), adresse: String(cfg.adresse).trim(), codePostal: String(cfg.codePostal).trim(), ville: String(cfg.ville).trim(), mention: MENTION_293B },
  };
};

// ── UNE VENTE → UNE FACTURE ──────────────────────────────────────────────────
// `ligne` = une ligne de `ventesDeclarables` ({ id, plateforme, ts, eur, titre,
// o?, dateVente? }). L'acheteur : ce que la vente PORTE (un nom), sinon
// « Particulier » — jamais un pseudo deviné.
export const acheteurDeVente = (ligne) => {
  const o = (ligne && ligne.o) || {};
  const n = String((ligne && ligne.acheteur) || o.buyerName || o.buyer_name || '').trim();
  return n || ACHETEUR_DEFAUT;
};
export const factureDepuisVente = (ligne, { numero, emiseLe }) => {
  const tVente = Date.parse((ligne && ligne.dateVente) || '') || (ligne && ligne.ts) || 0;
  return {
    numero: String(numero || ''),
    emiseLe: emiseLe || Date.now(),
    venteLe: tVente || null,
    plateforme: (ligne && ligne.plateforme) || '',
    reference: (ligne && ligne.id) || '',
    article: String((ligne && ligne.titre) || '').trim() || 'Article',
    centimes: centimesDe(ligne && ligne.eur),
    acheteur: acheteurDeVente(ligne),
  };
};

// ── LE XML CII, profil BASIC WL ──────────────────────────────────────────────
// ⚠️ L'ORDRE des éléments suit le schéma CII (un validateur refuse un désordre).
// Franchise de TVA : catégorie « E », taux 0, et la mention en motif
// d'exonération. Facture déjà payée sur la plateforme : TotalPrepaidAmount =
// total, DuePayableAmount = 0.
export const xmlFacturX = (f, v) => {
  const tot = eurDe(f.centimes);
  const adr = `<ram:PostalTradeAddress><ram:PostcodeCode>${xmlEchappe(v.codePostal)}</ram:PostcodeCode><ram:LineOne>${xmlEchappe(v.adresse)}</ram:LineOne><ram:CityName>${xmlEchappe(v.ville)}</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>`;
  const note = `Vente ${f.plateforme ? 'sur ' + f.plateforme : ''} : ${f.article}${f.reference ? ' (réf. ' + f.reference + ')' : ''}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE_BASICWL}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEchappe(f.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${ymd(f.emiseLe)}</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>${xmlEchappe(note)}</ram:Content></ram:IncludedNote>
    <ram:IncludedNote><ram:Content>${xmlEchappe(v.mention)}</ram:Content></ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEchappe(v.nom)}</ram:Name>
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${xmlEchappe(v.siren)}</ram:ID></ram:SpecifiedLegalOrganization>
        ${adr}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEchappe(f.acheteur)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>${f.venteLe ? `
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${ymd(f.venteLe)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    ` : ''}</ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:ExemptionReason>${xmlEchappe(v.mention)}</ram:ExemptionReason>
        <ram:BasisAmount>${tot}</ram:BasisAmount>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${tot}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${tot}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${tot}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${tot}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>0.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
};

const xmpFacturX = (titre) => `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEchappe(titre)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
   <pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
    <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
    <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
    <pdfaSchema:prefix>fx</pdfaSchema:prefix>
    <pdfaSchema:property><rdf:Seq>
     <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
     <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
     <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The version of the Factur-X standard</pdfaProperty:description></rdf:li>
     <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The conformance level of the embedded XML</pdfaProperty:description></rdf:li>
    </rdf:Seq></pdfaSchema:property>
   </rdf:li></rdf:Bag></pdfaExtension:schemas>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${PROFIL_FX}</fx:ConformanceLevel></rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

// La police standard du PDF (Helvetica, WinAnsi) ne dessine pas tout : un emoji
// ou un caractère asiatique dans un nom d'acheteur FAISAIT LEVER pdf-lib. On le
// remplace par « ? » plutôt que de ne rien produire. Le XML, lui, garde le texte.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
// Par POINT DE CODE (Array.from) : un emoji ne devient qu'un seul « ? ».
export const textePdf = (s) => Array.from(String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' '))
  .map((c) => { const k = c.codePointAt(0); return (k <= 0xFF && !(k >= 0x80 && k < 0xA0)) || WINANSI_EXTRA.includes(c) ? c : '?'; }).join('');

export const nomFichierFacture = (numero) => `facture-${String(numero || 'facturx').replace(/[^\w-]/g, '_')}.pdf`;

// Les octets du PDF Factur-X : la facture lisible + `factur-x.xml` embarqué
// (relation « Alternative ») + le XMP d'identification.
// ⚠️ La conformité PDF/A-3 stricte (polices embarquées, profil ICC) n'est PAS
// certifiée : aucun validateur officiel n'a tourné ici.
export const pdfFacturX = async (f, v) => {
  const { PDFDocument, StandardFonts, rgb, PDFName, AFRelationship } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, M = 50, encre = rgb(0.07, 0.08, 0.1), gris = rgb(0.42, 0.44, 0.48), filet = rgb(0.86, 0.87, 0.9), accent = rgb(0.14, 0.35, 0.9);
  const T = (t, x, y, { s = 10, b = false, c = encre, droite = false, max = 0 } = {}) => {
    const fo = b ? bold : font; let str = textePdf(t);
    if (max) while (str.length > 1 && fo.widthOfTextAtSize(str, s) > max) str = str.slice(0, -2) + '…';
    const w = fo.widthOfTextAtSize(str, s);
    page.drawText(str, { x: droite ? x - w : x, y, size: s, font: fo, color: c });
  };
  const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
  page.drawRectangle({ x: 0, y: 838, width: W, height: 4, color: accent });
  let y = 790;
  T('FACTURE', M, y, { s: 24, b: true });
  T('N° ' + f.numero, W - M, y + 6, { s: 11, b: true, droite: true });
  T('Émise le ' + frJour(f.emiseLe), W - M, y - 9, { s: 9, c: gris, droite: true });
  if (f.venteLe) T('Date de la vente : ' + frJour(f.venteLe), W - M, y - 22, { s: 9, c: gris, droite: true });
  y -= 60;
  const colB = 330;
  T('VENDEUR', M, y, { s: 8, b: true, c: gris }); T('CLIENT', colB, y, { s: 8, b: true, c: gris }); y -= 16;
  T(v.nom, M, y, { s: 11, b: true, max: 250 }); T(f.acheteur, colB, y, { s: 11, b: true, max: W - M - colB }); y -= 14;
  T(v.adresse, M, y, { s: 9, c: gris, max: 250 }); y -= 12;
  T(`${v.codePostal} ${v.ville}`, M, y, { s: 9, c: gris, max: 250 }); y -= 12;
  T((v.siret && v.siret.length === 14 ? 'SIRET ' + v.siret : 'SIREN ' + v.siren), M, y, { s: 9, c: gris });
  y -= 40;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.96, 0.965, 0.975) });
  T('Désignation', M + 8, y + 1, { s: 9, b: true }); T('Qté', 380, y + 1, { s: 9, b: true }); T('Montant', W - M - 8, y + 1, { s: 9, b: true, droite: true });
  y -= 24;
  T(f.article, M + 8, y, { s: 10, max: 300 }); T('1', 380, y, { s: 10 }); T(eur(f.centimes), W - M - 8, y, { s: 10, droite: true });
  if (f.plateforme) { y -= 13; T(`Vendu sur ${f.plateforme}${f.reference ? ' · réf. ' + f.reference : ''}`, M + 8, y, { s: 8.5, c: gris, max: 330 }); }
  y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: filet });
  y -= 24;
  T('Total', W - M - 160, y, { s: 12, b: true }); T(eur(f.centimes), W - M - 8, y, { s: 12, b: true, droite: true }); y -= 16;
  T('TVA', W - M - 160, y, { s: 9, c: gris }); T('0,00 €', W - M - 8, y, { s: 9, c: gris, droite: true }); y -= 16;
  T('Déjà payé', W - M - 160, y, { s: 9, c: gris }); T(eur(f.centimes), W - M - 8, y, { s: 9, c: gris, droite: true }); y -= 16;
  T('Reste à payer', W - M - 160, y, { s: 9, b: true }); T('0,00 €', W - M - 8, y, { s: 9, b: true, droite: true }); y -= 26;
  T(v.mention, M, y, { s: 9.5, b: true });
  T('Facture électronique Factur-X (profil BASIC WL) — données lisibles par machine dans le fichier joint factur-x.xml.', M, 44, { s: 7.5, c: gris });
  const xml = xmlFacturX(f, v);
  await pdf.attach(new TextEncoder().encode(xml), 'factur-x.xml', { mimeType: 'text/xml', description: 'Factur-X', creationDate: new Date(f.emiseLe), modificationDate: new Date(f.emiseLe), afRelationship: AFRelationship.Alternative });
  pdf.setTitle('Facture ' + f.numero); pdf.setAuthor(textePdf(v.nom)); pdf.setSubject('Facture'); pdf.setProducer('VRM'); pdf.setCreator('VRM');
  try { const st = pdf.context.stream(xmpFacturX('Facture ' + f.numero), { Type: 'Metadata', Subtype: 'XML' }); pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(st)); } catch (_) {}
  return await pdf.save({ useObjectStreams: false });
};

// ── LE RÉCAPITULATIF E-REPORTING DU MOIS ────────────────────────────────────
// Entrées : la sortie de `ventesDeclarables` (lignes datées au versement,
// `aDater`), le mois `ym` (AAAA-MM), `ymDe` (la règle de mois de l'app),
// `manque` (sources pas lues, nommées), `attente` (une source encore en
// lecture), `versementsLus` (false ⇒ les ventes Vinted ne peuvent pas être
// placées). Sortie : les lignes du mois, le total en centimes et la
// couverture. AUCUNE vente n'est reclassée ici.
export const recapEReporting = ({ lignes, aDater, ym, ymDe, manque = [], attente = false, versementsLus = true }) => {
  const duMois = (lignes || []).filter((l) => l && l.ts && ymDe(l.ts) === ym).slice().sort((a, b) => a.ts - b.ts);
  let total = 0; const parPlateforme = {}, parJour = {};
  for (const l of duMois) {
    const c = centimesDe(l.eur); if (!isFinite(c)) continue;
    total += c;
    const p = l.plateforme || 'Autre'; parPlateforme[p] = parPlateforme[p] || { centimes: 0, n: 0 }; parPlateforme[p].centimes += c; parPlateforme[p].n += 1;
    const j = isoJour(l.ts); parJour[j] = parJour[j] || { centimes: 0, n: 0 }; parJour[j].centimes += c; parJour[j].n += 1;
  }
  const manques = [];
  for (const m of manque) manques.push(`les ventes de ${m} (pas pu les lire)`);
  if (attente) manques.push('une source encore en lecture (Leboncoin ou eBay)');
  if (!versementsLus) manques.push('les ventes Vinted (dates de versement illisibles)');
  const nADater = (aDater || []).length, cADater = (aDater || []).reduce((s, l) => s + (centimesDe(l.eur) || 0), 0);
  if (nADater) manques.push(`${nADater} vente${nADater > 1 ? 's' : ''} finalisée${nADater > 1 ? 's' : ''} sans date de versement (${eurDe(cADater).replace('.', ',')} €) — elles peuvent appartenir à ce mois`);
  return { ym, lignes: duMois, n: duMois.length, centimes: total, parPlateforme, parJour, partiel: manques.length > 0, manques, nADater, cADater };
};

const csvCase = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
export const recapCsv = (r, vendeur) => {
  const L = [
    ['Recapitulatif e-reporting (ventes a des particuliers)', r.ym],
    ['Vendeur', vendeur ? `${vendeur.nom} - SIREN ${vendeur.siren}` : 'profil fiscal incomplet'],
    ['Datation', 'au jour du versement (Vinted), de la vente (Leboncoin), de la commande payee (eBay)'],
    ['Statut', r.partiel ? 'PARTIEL - total = AU MOINS' : 'complet'],
    ...r.manques.map((m) => ['Manque', m]),
    [],
    ['Date', 'Plateforme', 'Montant EUR', 'Reference', 'Article'],
    ...r.lignes.map((l) => [isoJour(l.ts), l.plateforme || '', eurDe(centimesDe(l.eur)), l.id || '', l.titre || '']),
    [],
    [r.partiel ? 'TOTAL (au moins)' : 'TOTAL', '', eurDe(r.centimes), `${r.n} vente${r.n > 1 ? 's' : ''}`, ''],
  ];
  return '﻿' + L.map((row) => row.map(csvCase).join(';')).join('\n');
};
export const recapJson = (r, vendeur) => JSON.stringify({
  type: 'e-reporting-b2c-recapitulatif',
  genere_par: 'VRM',
  periode: r.ym,
  devise: 'EUR',
  vendeur: vendeur ? { nom: vendeur.nom, siren: vendeur.siren } : null,
  datation: 'versement (Vinted), vente (Leboncoin), commande payee (eBay)',
  complet: !r.partiel,
  total_au_moins: r.partiel,
  manque: r.manques,
  total: eurDe(r.centimes),
  nombre: r.n,
  par_plateforme: Object.fromEntries(Object.entries(r.parPlateforme).map(([k, x]) => [k, { total: eurDe(x.centimes), nombre: x.n }])),
  par_jour: Object.entries(r.parJour).sort().map(([d, x]) => ({ date: d, total: eurDe(x.centimes), nombre: x.n })),
  ventes: r.lignes.map((l) => ({ date: isoJour(l.ts), plateforme: l.plateforme || '', montant: eurDe(centimesDe(l.eur)), reference: l.id || '', article: l.titre || '' })),
}, null, 2);
