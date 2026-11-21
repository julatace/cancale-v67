#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — la facture au téléphone (12 nov., Julien : « Corrige les bugs de facture »)
// ════════════════════════════════════════════════════════════════════════════
// Le rendu de la feuille (miniature, débordements, « Envoyer avec VRM ») est jugé
// par le banc scripts/bancs/facture-mobile.cjs. Ici, ce qu'aucun écran ne montre :
//
//   P · LE PDF ENVOYÉ À L'ACHETEUR, dessiné par le VRAI src/facturePro/pdf.js sur des
//       factures INVENTÉES (bilingue, acheteuse aux Pays-Bas, adresse e-mail privée
//       de relais Vinted, titre long, e-mail sans espace de 70 caractères, les trois
//       régimes de TVA). Chaque texte posé est relevé (position, taille, police) :
//       rien ne sort des marges, aucun texte n'en chevauche un autre, la désignation
//       reste dans SA colonne, les montants sont alignés à droite sur la même ligne
//       verticale, la mention 293 B (française PUIS traduite) et « acquittée » sont là.
//   G · LE GABARIT DE L'APERÇU pose ses largeurs lui-même (le même tableau à 390 px
//       qu'à 1512) : `table-layout: fixed`, colonnes de chiffres en largeur fixe,
//       en-têtes qui passent à la ligne ; l'aperçu d'une feuille est une miniature.
//   E · La phrase « laisse VRM envoyer » n'existe plus sans le bouton qui le fait.
//
// Lancer : node scripts/audit-facture-mobile.cjs   (RACINE=<arbre> pour juger un autre arbre)
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const RACINE = process.env.RACINE || path.join(__dirname, '..');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const TITRE = 'Nike SB Dunk Low Pro « Travis Scott » Cactus Jack Special Box édition limitée — Taille 44,5 EU, état neuf avec boîte d’origine';

(async () => {
  const regle = await import(pathToFileURL(path.join(RACINE, 'src/facturePro/regle.js')).href);
  const { pdfFacture } = await import(pathToFileURL(path.join(RACINE, 'src/facturePro/pdf.js')).href);
  const PL = await import('pdf-lib');

  // Un pdf-lib qui RELÈVE chaque texte posé (le vrai dessin, rien de simulé).
  const releve = [];
  const PDFLib = { ...PL, PDFDocument: { create: async (...a) => {
    const doc = await PL.PDFDocument.create(...a);
    const ajout = doc.addPage.bind(doc);
    doc.addPage = (...b) => {
      const page = ajout(...b);
      const dessine = page.drawText.bind(page);
      page.drawText = (t, o) => { releve.push({ t, x: o.x, y: o.y, size: o.size, w: o.font.widthOfTextAtSize(t, o.size), gras: /Bold/.test(o.font.name || '') }); return dessine(t, o); };
      return page;
    };
    return doc;
  } } };
  const W = 595.28, M = 48;

  const cas = [
    ['bilingue franchise, Pays-Bas, relais', { tva_regime: 'franchise' }, 'en', 'u8f2k9q4x7m1z3c5w6v0@privaterelay.vinted.test'],
    ['bilingue TVA 20 %', { tva_regime: 'normal', tva_taux: 20, tva: 'FR00' + SIREN }, 'en', 'u8f2k9q4x7m1z3c5w6v0@privaterelay.vinted.test'],
    ['bilingue marge', { tva_regime: 'marge', tva: 'FR00' + SIREN }, 'en', 'u8f2k9q4x7m1z3c5w6v0@privaterelay.vinted.test'],
    ['français, e-mail sans espace de 70 caractères', { tva_regime: 'franchise' }, 'fr', 'a'.repeat(52) + '@privaterelay.vinted.test'],
  ];
  for (const [nom, tva, langue, email] of cas) {
    console.log(`\n— P · ${nom}`);
    releve.length = 0;
    const cfg = { nom: 'Boutique Banc Sneakers et Collections Rares', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', note: 'Merci pour votre achat !', ...tva };
    const c = regle.contenuFacture(cfg, { acheteur: { nom: 'Sanne van der Berg-Hoogeveen', adresse: regle.adresseVintedLisible('Prinsengracht, 263, Amsterdam, 1016 GV, NL, Nederland'), email }, designation: TITRE, centimes: 123450, venteLe: '2026-11-08T10:00:00Z', reference: '17123456789', plateforme: 'Vinted' }, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-12T08:00:00Z'), langue });
    const octets = await pdfFacture(c, { PDFLib });
    dit(Buffer.from(octets).slice(0, 5).toString() === '%PDF-', 'P0 le PDF se fabrique');
    const T = releve.filter((r) => r.t.trim());
    const hors = T.filter((r) => r.x < M - 0.5 || r.x + r.w > W - M + 0.5 || r.y < 20 || r.y > 842);
    dit(!hors.length, 'P1 aucun texte ne sort des marges de la page', hors.slice(0, 3).map((r) => `« ${r.t.slice(0, 30)} » ${Math.round(r.x)}→${Math.round(r.x + r.w)}`).join(' | '));
    // Chevauchement : deux boîtes de texte qui se recouvrent (x ET y).
    const boite = (r) => ({ x0: r.x, x1: r.x + r.w, y0: r.y - r.size * 0.22, y1: r.y + r.size * 0.72 });
    const chev = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const a = boite(T[i]), b = boite(T[j]);
      if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5) chev.push(`« ${T[i].t.slice(0, 20)} » / « ${T[j].t.slice(0, 20)} »`);
    }
    dit(!chev.length, 'P2 aucun texte n’en chevauche un autre', chev.slice(0, 3).join(' | '));
    // La désignation : ses lignes restent à gauche de la colonne « Qté ».
    const lignesDes = T.filter((r) => TITRE.replace(/[«»’—]/g, ' ').split(/\s+/).filter((m) => m.length > 3).some((m) => r.t.includes(m)) && r.x < W / 2 && !/FACTUR|VENDEUR/.test(r.t));
    const xQte = W - M - 200;
    dit(lignesDes.length >= 2 && lignesDes.every((r) => r.x + r.w < xQte - 20), 'P3 la désignation passe à la ligne dans SA colonne (jamais sous « Qté »)', lignesDes.map((r) => Math.round(r.x + r.w)).join(','));
    // Les montants (« … € ») de la colonne Total : alignés à droite sur la même verticale.
    const montants = T.filter((r) => /€$/.test(r.t) && r.x > W / 2);
    const bords = [...new Set(montants.map((r) => Math.round(r.x + r.w)))];
    dit(montants.length >= 3 && bords.length <= 2, 'P4 montants alignés à droite (deux verticales : prix unitaire, total)', bords.join(','));
    const texte = T.map((r) => r.t).join(' ');
    dit(/acquitt/i.test(texte) && /1 234,50 €/.test(texte.replace(/ | /g, ' ')), 'P5 « acquittée » et le montant sont écrits');
    if (tva.tva_regime === 'franchise') dit(/TVA non applicable, art\. 293 B du CGI/.test(texte) && (langue !== 'en' || /VAT not applicable, article 293 B/.test(texte)), 'P6 mention 293 B mot pour mot en français' + (langue === 'en' ? ', puis sa traduction' : ''));
    if (langue === 'en') dit(/FACTURE \/ INVOICE/.test(texte) && /Description/.test(texte) && /Qty/.test(texte), 'P7 bilingue : titre et en-têtes « français / English »');
    const xAch = M + (W - 2 * M - 24) / 2 + 24;   // la colonne « Facturé à »
    const emailVu = T.filter((r) => Math.abs(r.x - xAch) < 0.5 && r.t.length >= 3 && email.includes(r.t)).map((r) => r.t).join('');
    dit(emailVu.replace(/\s/g, '') === email, 'P8 l’adresse e-mail de l’acheteuse est écrite en entier (coupée en lignes si besoin, rien de perdu)', emailVu);
  }

  // ── G · le gabarit de l'aperçu ────────────────────────────────────────────
  console.log('\n— G · le gabarit de l’aperçu');
  const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = sansCom(fs.readFileSync(path.join(RACINE, 'src/facture-pro.css'), 'utf8'));
  const jsx = fs.readFileSync(path.join(RACINE, 'src/FacturePro.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const regles = (sel) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, s]) => sel.test(s)).map(([, , d]) => d).join(';');
  const derniere = (decl, prop) => { const m = [...decl.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))]; return m.length ? m[m.length - 1][1].trim() : ''; };
  dit(derniere(regles(/\.vrm-fp-a-table\s*$/), 'table-layout') === 'fixed', 'G1 le tableau de la facture pose SES largeurs (`table-layout: fixed`)', derniere(regles(/\.vrm-fp-a-table\s*$/), 'table-layout'));
  const thNowrap = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, s, d]) => /\.vrm-fp-a-table th(?![a-z-])/.test(s) && /white-space\s*:\s*nowrap/.test(d));
  dit(!thNowrap.length, 'G2 aucun en-tête de colonne en `nowrap` (un en-tête bilingue élargissait les chiffres jusqu’à écraser la désignation)', thNowrap.map(([, s]) => s.trim()).join(' | ').slice(0, 160));
  dit(/<colgroup>[\s\S]{0,200}vrm-fp-a-col-qte[\s\S]{0,200}vrm-fp-a-col-prix/.test(jsx) && /col\.vrm-fp-a-col-qte\s*\{\s*width:\s*[\d.]+em/.test(css) && /col\.vrm-fp-a-col-prix\s*\{\s*width:\s*[\d.]+em/.test(css), 'G3 Qté et prix en largeur fixe, posée par la facture elle-même (colgroup)');
  dit(/white-space\s*:\s*nowrap/.test(regles(/\.vrm-fp-a-totaux dd/)), 'G4 un montant des totaux ne passe jamais à la ligne');
  const feuilles = [jsx, fs.readFileSync(path.join(RACINE, 'src/FactureAutres.jsx'), 'utf8')];
  const nus = feuilles.flatMap((s) => [...s.matchAll(/<section className="vrm-fp-section"><h3>Aperçu de la facture<\/h3>(<[A-Za-z]+)/g)].map((m) => m[1]));
  dit(nus.length >= 2 && nus.every((t) => t === '<MiniatureFacture'), 'G5 dans une feuille, l’aperçu est une miniature (la vraie largeur, mise à l’échelle)', nus.join(','));

  // ── E · la phrase et le bouton ─────────────────────────────────────────────
  console.log('\n— E · « laisse VRM envoyer »');
  dit(!/laisse VRM envoyer/.test(jsx), 'E1 l’app ne dit plus « laisse VRM envoyer » sans bouton : elle offre « Envoyer avec VRM »');
  dit(/data-fp-envoyer-vrm[^>]*onClick=\{\(\) => emettre\(true, 'vrm'\)\}/.test(jsx) && /via === 'vrm' \? \{ via: 'vrm' \}/.test(jsx), 'E2 « Envoyer avec VRM » demande l’envoi par VRM pour CETTE facture (`via: \'vrm\'`)');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-facture-mobile :', e); process.exit(1); });
