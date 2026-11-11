#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LOT T : FACTURE EN ANGLAIS + SEUIL DE TVA À CÔTÉ DES FACTURES
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE les vraies règles (aucune donnée réelle : vendeur, acheteur, SIRET et
// chiffres d'affaires inventés) :
//   F  la facture en anglais (src/facturePro/anglais.js, regle.js, pdf.js) :
//      bilingue, le français mot pour mot, les 14 mentions, toujours en euros,
//      le PDF lu (texte décompressé), l'e-mail, l'avoir, l'indice « hors France » ;
//   S  le seuil de TVA (src/seuilTvaFacture.js sur `jaugeSeuils`) : rien sur un
//      « pas su », pas d'alerte sous 80 %, ambre à 80 %, au dépassement, au
//      seuil majoré, CA N-1 ; jamais d'alerte à qui facture déjà la TVA ni sur
//      une fiche illisible ; un CA partiel n'alerte que s'il est certain ;
//   B  le branchement : l'écran Factures monte la jauge, la porte ouvre « Ma
//      facture » sur le régime de TVA, l'option part à la route.
// La route elle-même (émission en anglais, figée) : scripts/audit-facture-pro.cjs, T1-T4.
'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const racine = path.resolve(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// Le texte d'un PDF de pdf-lib : flux décompressés, chaînes hexadécimales WinAnsi.
const WIN = { 0x80: '€', 0x92: "'", 0x96: '–', 0x97: '—' };
async function textePdf(octets) {
  const PL = require(path.join(racine, 'node_modules/pdf-lib'));
  const doc = await PL.PDFDocument.load(octets);
  let t = '';
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!obj || !obj.contents) continue;
    let b = Buffer.from(obj.contents);
    try { b = zlib.inflateSync(b); } catch (_) {}
    const s = b.toString('latin1');
    for (const m of s.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
      const h = Buffer.from(m[1], 'hex');
      t += [...h].map((x) => WIN[x] || String.fromCharCode(x)).join('') + '\n';
    }
  }
  return t;
}

(async () => {
  const regle = await import(path.join(racine, 'src/facturePro/regle.js'));
  const EN = await import(path.join(racine, 'src/facturePro/anglais.js'));
  const { pdfFacture } = await import(path.join(racine, 'src/facturePro/pdf.js'));
  const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
  const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
  const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
  const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test' };
  const V = { acheteur: { nom: 'Giulia Banco', adresse: 'Via Inventata 3\n00100 Roma\nItalia', email: 'giulia@exemple.test' }, designation: 'Asics Metaspeed banc - Taille 43,5', centimes: 12950, venteLe: '2026-10-30T22:30:00Z', reference: '23000000901', plateforme: 'Vinted' };
  const O = { numero: 'FA-2026-0007', emiseLe: Date.parse('2026-11-10T10:00:00Z') };

  // ══ F : LA FACTURE EN ANGLAIS ═════════════════════════════════════════════
  const fr = regle.contenuFacture(CFG, V, O);
  const frExplicite = regle.contenuFacture(CFG, V, { ...O, langue: 'fr' });
  const en = regle.contenuFacture(CFG, V, { ...O, langue: 'en' });
  dit(!('anglais' in fr) && JSON.stringify(fr) === JSON.stringify(frExplicite), 'F1 sans l’option, l’instantané est identique à celui d’avant (aucune clé ajoutée)', Object.keys(fr).join(','));
  const { anglais, ...enSans } = en;
  dit(JSON.stringify(enSans) === JSON.stringify(fr), 'F2 en anglais, TOUT le français est gardé tel quel (numéro, montants, mentions, paiement)', '');
  dit(anglais && anglais.mentions[0] === EN.MENTIONS_EN[regle.MENTION_FRANCHISE] && /^VAT not applicable, article 293 B/.test(anglais.mentions[0]) && /^Invoice paid on 30\/10\/2026 via Vinted\.$/.test(anglais.paiement),
    'F3 la mention 293 B et le paiement ont leur traduction, figée dans l’instantané', JSON.stringify(anglais));
  dit(regle.mentionsManquantes(en).length === 0, 'F4 la facture en anglais porte les 14 mentions obligatoires', regle.mentionsManquantes(en).join(','));
  dit(en.totaux.ttc === 12950 && fr.totaux.ttc === 12950, 'F5 mêmes montants, en centimes d’euro (aucune conversion)', '');
  const marge = regle.contenuFacture({ ...CFG, tva_regime: 'marge', tva: 'FR00' + SIREN }, V, { ...O, langue: 'en' });
  dit(marge.mentions[0] === regle.MENTION_MARGE && /^Margin scheme – Second-hand goods/.test(marge.anglais.mentions[0]) && marge.totaux.tva === null, 'F6 régime de la marge : mention française + « Margin scheme – Second-hand goods », jamais de TVA écrite', marge.anglais.mentions[0]);
  const normal = regle.contenuFacture({ ...CFG, tva_regime: 'normal', tva_taux: 20, tva: 'FR00' + SIREN }, V, { ...O, langue: 'en' });
  dit(normal.anglais.mentions.length === 0 && normal.totaux.tva === 2158, 'F7 TVA classique : aucune mention à traduire, TVA calculée comme avant', JSON.stringify(normal.totaux));
  for (const cle of Object.keys(EN.MENTIONS_EN)) dit([regle.MENTION_FRANCHISE, regle.MENTION_MARGE].includes(cle), `F8 la table de traduction suit le texte EXACT de regle.js (« ${cle.slice(0, 30)}… »)`, '');

  // Le PDF
  const tEn = await textePdf(Buffer.from(await pdfFacture(en)));
  const tFr = await textePdf(Buffer.from(await pdfFacture(fr)));
  dit(/FACTURE \/ INVOICE/.test(tEn) && /TVA non applicable, art\. 293 B du CGI/.test(tEn) && /VAT not applicable, article 293 B/.test(tEn) && /Invoice paid on 30\/10\/2026/.test(tEn),
    'F9 le PDF bilingue : « FACTURE / INVOICE », la mention française PUIS sa traduction, le paiement', tEn.split('\n').slice(0, 8).join(' | '));
  const libs = ['VENDEUR / SELLER', 'FACTURÉ À / BILL TO', 'Date de la vente / Date of sale', 'Désignation', 'Description', 'Total HT', 'Total excl. VAT', 'Net à payer', 'Amount due', 'not applicable'];
  const absents = libs.filter((l) => !tEn.includes(l));
  dit(!absents.length, 'F10 chaque libellé du PDF a son français ET son anglais', absents.join(', '));
  dit(/129,50\s€/.test(tEn) && !/\$|£|USD|GBP/.test(tEn), 'F11 le PDF reste en euros (129,50 €, ni $ ni £)', (tEn.match(/\d+,\d{2}.?€/g) || []).join(' '));
  dit(!/INVOICE|SELLER|VAT/.test(tFr) && /FACTURE/.test(tFr), 'F12 sans l’option, le PDF ne contient aucun mot anglais', '');
  // L'avoir reprend l'instantané (comme api/_lib/facture-pro.js) et dit « remboursé ».
  const av = { ...en, type: 'avoir', numero: 'AV-2026-0001', origine: en.numero, paiement: "Montant remboursé à l'acheteur.", totaux: { ht: -12950, tva: null, ttc: -12950 }, lignes: en.lignes.map((l) => ({ ...l, unite: -l.unite, total: -l.total })) };
  const tAv = await textePdf(Buffer.from(await pdfFacture(av)));
  dit(/AVOIR \/ CREDIT NOTE/.test(tAv) && /Amount refunded to the buyer\./.test(tAv) && !/Invoice paid on/.test(tAv), 'F13 l’avoir d’une facture en anglais : « AVOIR / CREDIT NOTE », « remboursé » traduit', '');

  // L'e-mail
  const m = regle.emailFacture(CFG, en, { via: 'vrm' });
  dit(/^Facture \/ Invoice FA-2026-0007/.test(m.sujet) && /Please find attached invoice FA-2026-0007/.test(m.texte) && /Vous trouverez ci-joint la facture FA-2026-0007/.test(m.texte) && !/on behalf of|pour le compte de/.test(m.texte + m.html),
    'F14 l’e-mail : objet bilingue, message par défaut anglais puis français, aucun pied VRM (11 nov.)', m.sujet);
  const mPerso = regle.emailFacture({ ...CFG, message: 'Ciao {acheteur}, grazie !' }, en, { via: 'boite' });
  dit(mPerso.texte === 'Ciao Giulia Banco, grazie !', 'F15 un message écrit par le vendeur reste le sien (jamais traduit)', mPerso.texte);
  const mFr = regle.emailFacture(CFG, fr, { via: 'vrm' });
  dit(!/Invoice|Please|on behalf/.test(mFr.texte + mFr.sujet + mFr.html), 'F16 sans l’option, l’e-mail est exactement français', mFr.sujet);
  // L'indice « hors France »
  const adr = regle.adresseVintedLisible;
  const h = EN.acheteurHorsFrance;
  dit(h(adr('Via Inventata, 3, Roma, 00100, IT, Italia')) && h('12 rue X\n1000 Bruxelles\nBelgique') && !h(adr('rue de la Paix, 12, Saint Malo, 35400, FR, France')) && !h('12 rue X\n75011 Paris') && !h('') && !h(null) && !h('forme inconnue'),
    'F17 « hors France » pré-coché seulement si l’adresse PROUVÉE finit par un pays étranger', '');

  // ══ S : LE SEUIL DE TVA ═══════════════════════════════════════════════════
  const { alerteSeuilTva, phrasesSeuilTva } = await import(path.join(racine, 'src/seuilTvaFacture.js'));
  const now = new Date(2026, 10, 10, 12);
  const L = (ca, extra = {}) => ({ mois: [{ ym: '2026-03', ca: ca / 2 }, { ym: '2026-07', ca: ca / 2 }], sources: { Vinted: 'lu' }, ...extra });
  dit(alerteSeuilTva({ ligne: null, now, regime: 'franchise' }) === null && alerteSeuilTva({ ligne: undefined, now, regime: 'franchise' }) === null, 'S1 pas de ligne publiée (pas su) : rien, jamais 0 ni alerte', '');
  dit(alerteSeuilTva({ ligne: L(90000), now: new Date(2031, 0, 5), regime: 'franchise' }) === null, 'S2 année sans seuils vérifiés : rien (jamais un seuil périmé)', '');
  const s60 = alerteSeuilTva({ ligne: L(51000), now, regime: 'franchise' });
  dit(s60 && s60.alerte === null && s60.niveau === 'ok' && s60.pct === 60, 'S3 à 60 % : la jauge, aucune alerte', JSON.stringify(s60 && { a: s60.alerte, p: s60.pct }));
  const s79 = alerteSeuilTva({ ligne: L(67915), now, regime: 'franchise' });
  const s80 = alerteSeuilTva({ ligne: L(68000), now, regime: 'franchise' });
  dit(s79.alerte === null && s80.alerte === 'proche', 'S4 la borne : 79,9 % rien, 80 % alerte ambre « proche »', `${s79.pct} → ${s79.alerte} · ${s80.pct} → ${s80.alerte}`);
  dit(/^Tu factures sans TVA : 80 % du seuil\.$/.test(phrasesSeuilTva(s80).titre) && /1er janvier 2027/.test(phrasesSeuilTva(s80).change), 'S5 « tu factures sans TVA, tu es à 80 % du seuil » et ce que ça change', phrasesSeuilTva(s80).titre);
  const sDep = alerteSeuilTva({ ligne: L(88000), now, regime: 'franchise' });
  dit(sDep.alerte === 'depasse' && sDep.etat === 'base_depasse' && /1er janvier 2027/.test(phrasesSeuilTva(sDep).change), 'S6 au-dessus de 85 000 € : alerte « dépassé », TVA au 1er janvier suivant', sDep.etat);
  const sMaj = alerteSeuilTva({ ligne: L(94000), now, regime: 'franchise' });
  dit(sMaj.alerte === 'depasse' && sMaj.etat === 'majore_depasse' && /jour du dépassement/.test(phrasesSeuilTva(sMaj).change), 'S7 au-dessus de 93 500 € : TVA due le jour du dépassement', sMaj.etat);
  const sPrec = alerteSeuilTva({ ligne: { mois: [{ ym: '2025-06', ca: 86000 }, { ym: '2026-02', ca: 1000 }], sources: {} }, now, regime: 'franchise' });
  dit(sPrec.alerte === 'depasse' && sPrec.etat === 'due_depuis_janvier', 'S8 CA de l’an dernier au-dessus du seuil : TVA due depuis janvier', sPrec.etat);
  const sNorm = alerteSeuilTva({ ligne: L(94000), now, regime: 'normal' });
  const sMarge = alerteSeuilTva({ ligne: L(94000), now, regime: 'marge' });
  dit(sNorm.alerte === null && sNorm.assujetti && sMarge.alerte === null, 'S9 il facture déjà la TVA (classique ou marge) : aucune alerte', '');
  const sLect = alerteSeuilTva({ ligne: L(94000), now, regime: undefined });
  const sKo = alerteSeuilTva({ ligne: L(94000), now, regime: null });
  dit(sLect.alerte === null && sKo.alerte === null && !sKo.regimeSu, 'S10 fiche « Ma facture » en lecture ou illisible (pas su) : jamais d’alerte', '');
  const sVide = alerteSeuilTva({ ligne: L(70000), now, regime: '' });
  dit(sVide.alerte === 'proche' && sVide.regime === '', 'S11 régime pas encore choisi : l’alerte vaut (le seuil le concerne), la porte dit de choisir', '');
  const sPart = alerteSeuilTva({ ligne: L(60000, { sources: { Vinted: 'lu', Leboncoin: 'pasSu' } }), now, regime: 'franchise' });
  const sPartHaut = alerteSeuilTva({ ligne: L(70000, { sources: { Vinted: 'lu', Leboncoin: 'pasSu' } }), now, regime: 'franchise' });
  dit(sPart.alerte === null && sPart.partiel && sPartHaut.alerte === 'proche' && sPartHaut.partiel, 'S12 CA partiel (un minimum) : sous 80 % rien, à 80 % l’alerte (certaine, « au moins »)', `${sPart.pct} · ${sPartHaut.pct}`);
  const sServ = alerteSeuilTva({ ligne: L(32000), now, regime: 'franchise', activite: 'services' });
  dit(sServ.alerte === 'proche' && sServ.seuil === 37500, 'S13 prestations de services : SES seuils (37 500 €)', String(sServ.seuil));

  // ══ B : LE BRANCHEMENT ════════════════════════════════════════════════════
  const lire = (f) => sansCommentaires(fs.readFileSync(path.join(racine, f), 'utf8'));
  const compta = lire('src/ecrans/Compta.jsx');
  const debutInv = compta.indexOf('function Invoices(');
  const corpsInv = compta.slice(debutInv, compta.indexOf('\nfunction ', debutInv + 10));
  dit(/import\('\.\.\/SeuilTvaFactures\.jsx'\)/.test(compta) && /<SeuilTvaFactures deps=\{DEPS_FACTURE\}\/>/.test(corpsInv), 'B1 l’écran Factures monte la jauge du seuil de TVA', '');
  const comp = lire('src/SeuilTvaFactures.jsx');
  dit(/alerteSeuilTva\(/.test(comp) && /<FicheFacturation deps=\{deps\} focus="tva_regime"\/>/.test(comp) && /data-seuil-tva-porte="tva_regime"/.test(comp), 'B2 la porte ouvre « Ma facture » sur le régime de TVA', '');
  dit(!/jaugeSeuils|85000|93500|0\.8\b/.test(comp), 'B3 l’écran ne recalcule rien (ni seuil, ni pourcentage : la règle)', '');
  const fp = lire('src/FacturePro.jsx');
  dit(/langue: anglais \? 'en' : 'fr'[^}]*\}\);/.test(fp.slice(fp.indexOf("action: 'emettre'") - 10, fp.indexOf("action: 'emettre'") + 200)) && /data-fp-anglais=/.test(fp), 'B4 la case « Facture en anglais » part à la route d’émission', '');
  const api = lire('api/_lib/facture-pro.js');
  dit(/contenuFacture\(cfg, vente, \{ numero, emiseLe, langue: corps\.langue === 'en' \? 'en' : 'fr' \}\)/.test(api), 'B5 le serveur ne lit que « en » (tout le reste = français)', '');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
