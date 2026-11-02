// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — le PDF (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Dessine l'INSTANTANÉ (`contenuFacture`, ./regle.js) en un PDF A4, avec
// pdf-lib — le même code dans l'app (aperçu, téléchargement) et sur le serveur
// (pièce jointe de l'e-mail) : l'acheteur reçoit exactement ce que le vendeur a
// vu. Rien n'est lu ailleurs que dans l'instantané.
//
// · Police standard Helvetica (WinAnsi) : un caractère qu'elle ne sait pas
//   dessiner (emoji, idéogramme) est remplacé, jamais une erreur qui bloque la
//   facture (`propre`).
// · Un texte trop long se coupe en lignes ; une désignation interminable est
//   bornée (8 lignes) — jamais un texte qui sort de la page.
// · Le logo est une image PNG/JPEG de l'instantané ; illisible ⇒ la facture
//   part sans logo (il n'est pas une mention obligatoire).

import { euros, MENTION_FRANCHISE } from './regle.js';

const A4 = [595.28, 841.89];
const M = 48;                       // marge
const GRIS = [0.42, 0.42, 0.45];
const ENCRE = [0.11, 0.11, 0.12];
const FILET = [0.86, 0.86, 0.88];

const hexRgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
  const n = m ? parseInt(m[1], 16) : 0x1d1d1f;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export async function pdfFacture(contenu, { PDFLib } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  const estAvoir = contenu.type === 'avoir';
  doc.setTitle(`${estAvoir ? 'Avoir' : 'Facture'} ${contenu.numero}`);
  doc.setAuthor(contenu.vendeur.nom);
  doc.setCreator(contenu.vendeur.nom);
  doc.setProducer(contenu.vendeur.nom);
  doc.setCreationDate(new Date(contenu.emiseLe));
  doc.setModificationDate(new Date(contenu.emiseLe));
  const page = doc.addPage(A4);
  const [W, H] = A4;
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = (a) => rgb(a[0], a[1], a[2]);
  const accent = hexRgb(contenu.couleur);

  // Un caractère que Helvetica ne sait pas dessiner est remplacé.
  const cache = new Map();
  const dessinable = (ch) => {
    if (cache.has(ch)) return cache.get(ch);
    let ok = true; try { f.encodeText(ch); fb.encodeText(ch); } catch (_) { ok = false; }
    cache.set(ch, ok); return ok;
  };
  const propre = (s) => {
    const t = String(s == null ? '' : s).normalize('NFC')
      .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
      .replace(/[   ]/g, ' ').replace(/[\r\n\t]+/g, ' ');
    let out = ''; for (const ch of t) out += dessinable(ch) ? ch : (ch.normalize('NFD').replace(/[̀-ͯ]/g, '').split('').every(dessinable) ? ch.normalize('NFD').replace(/[̀-ͯ]/g, '') : '?');
    return out;
  };
  const larg = (s, font, t) => font.widthOfTextAtSize(s, t);
  // Coupe en lignes de largeur max ; un mot plus long que la ligne est coupé.
  const couper = (s, font, t, max) => {
    const mots = propre(s).split(' ').filter((x) => x !== '');
    const res = []; let l = '';
    for (let mot of mots) {
      while (larg(mot, font, t) > max) {
        let i = mot.length; while (i > 1 && larg(mot.slice(0, i), font, t) > max) i--;
        if (l) { res.push(l); l = ''; }
        res.push(mot.slice(0, i)); mot = mot.slice(i);
      }
      const essai = l ? `${l} ${mot}` : mot;
      if (larg(essai, font, t) <= max) l = essai; else { if (l) res.push(l); l = mot; }
    }
    if (l) res.push(l);
    return res.length ? res : [''];
  };
  const ecrire = (s, x, y, { font = f, t = 9.5, couleur = ENCRE, droite = false, centre = false } = {}) => {
    const p = propre(s);
    const w = larg(p, font, t);
    page.drawText(p, { x: droite ? x - w : centre ? x - w / 2 : x, y, size: t, font, color: c(couleur) });
  };

  let y = H - M;

  // ── En-tête : logo à gauche, « FACTURE » et son numéro à droite ──────────
  let hLogo = 0;
  if (contenu.logo) {
    try {
      const b64 = contenu.logo.split(',')[1] || '';
      const octets = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64') : Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
      const img = /^data:image\/png/.test(contenu.logo) ? await doc.embedPng(octets) : await doc.embedJpg(octets);
      const k = Math.min(150 / img.width, 64 / img.height, 1);
      const w = img.width * k; hLogo = img.height * k;
      page.drawImage(img, { x: M, y: y - hLogo, width: w, height: hLogo });
    } catch (_) { hLogo = 0; }
  }
  ecrire(estAvoir ? 'AVOIR' : 'FACTURE', W - M, y - 20, { font: fb, t: 22, droite: true });
  ecrire(`N° ${contenu.numero}`, W - M, y - 38, { font: fb, t: 11, couleur: accent, droite: true });
  ecrire(`Date d'émission : ${contenu.emiseJour}`, W - M, y - 53, { t: 9.5, couleur: GRIS, droite: true });
  if (estAvoir && contenu.origine) ecrire(`Annule la facture ${contenu.origine}`, W - M, y - 66, { t: 9.5, couleur: GRIS, droite: true });
  y -= Math.max(hLogo, estAvoir ? 70 : 58) + 26;

  // ── Vendeur | Acheteur ───────────────────────────────────────────────────
  const col = (W - 2 * M - 24) / 2;
  const bloc = (titre, nom, lignesTxt, x) => {
    let yy = y;
    ecrire(titre, x, yy, { font: fb, t: 8, couleur: GRIS }); yy -= 14;
    for (const l of couper(nom, fb, 10.5, col)) { ecrire(l, x, yy, { font: fb, t: 10.5 }); yy -= 13; }
    for (const brut of lignesTxt.filter(Boolean)) for (const l of couper(brut, f, 9.5, col)) { ecrire(l, x, yy); yy -= 12.5; }
    return yy;
  };
  const v = contenu.vendeur; const a = contenu.acheteur;
  const y1 = bloc('VENDEUR', v.nom, [...v.adresse, ...v.legal, v.email, v.telephone], M);
  const y2 = bloc(estAvoir ? 'CLIENT' : 'FACTURÉ À', a.nom, [...a.adresse, a.email], M + col + 24);
  y = Math.min(y1, y2) - 18;

  // ── Les infos de la vente ────────────────────────────────────────────────
  const infos = [`Date de la vente : ${contenu.venteJour}`, `Nature : ${contenu.nature}`, contenu.reference ? `Référence : ${contenu.reference}` : ''].filter(Boolean).join('   ·   ');
  for (const l of couper(infos, f, 9, W - 2 * M)) { ecrire(l, M, y, { t: 9, couleur: GRIS }); y -= 12; }
  y -= 10;

  // ── Le tableau ───────────────────────────────────────────────────────────
  const marge = contenu.regime === 'marge';
  const cols = { des: M, qte: W - M - 200, pu: W - M - 95, tot: W - M };
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: c(accent), opacity: 0.08 });
  page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 1, color: c(accent) });
  ecrire('Désignation', cols.des + 6, y, { font: fb, t: 9 });
  ecrire('Qté', cols.qte, y, { font: fb, t: 9, droite: true });
  ecrire(marge ? 'Prix unitaire' : 'Prix unit. HT', cols.pu, y, { font: fb, t: 9, droite: true });
  ecrire(marge ? 'Total' : 'Total HT', cols.tot - 6, y, { font: fb, t: 9, droite: true });
  y -= 24;
  for (const ligne of contenu.lignes) {
    const ls = couper(ligne.designation, f, 9.5, cols.qte - cols.des - 50).slice(0, 8);
    ls.forEach((l, i) => ecrire(l, cols.des + 6, y - i * 12.5));
    ecrire(String(ligne.quantite), cols.qte, y, { droite: true });
    ecrire(euros(ligne.unite), cols.pu, y, { droite: true });
    ecrire(euros(ligne.total), cols.tot - 6, y, { droite: true });
    y -= ls.length * 12.5 + 8;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: c(FILET) });
    y -= 10;
  }

  // ── Les totaux ───────────────────────────────────────────────────────────
  const xL = W - M - 230; const xR = W - M - 6;
  const tot = (lib, val, gras = false) => { ecrire(lib, xL, y, { font: gras ? fb : f, t: gras ? 11 : 9.5 }); ecrire(val, xR, y, { font: gras ? fb : f, t: gras ? 11 : 9.5, droite: true }); y -= gras ? 18 : 14; };
  const T = contenu.totaux;
  if (contenu.regime === 'normal') {
    tot('Total HT', euros(T.ht));
    tot(`TVA ${String(contenu.taux).replace('.', ',')} %`, euros(T.tva));
    page.drawLine({ start: { x: xL, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.5, color: c(FILET) }); y -= 4;
    tot(estAvoir ? 'Total TTC à rembourser' : 'Total TTC', euros(T.ttc), true);
  } else if (contenu.regime === 'franchise') {
    tot('Total HT', euros(T.ht));
    tot('TVA', 'non applicable');
    page.drawLine({ start: { x: xL, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.5, color: c(FILET) }); y -= 4;
    tot(estAvoir ? 'Montant à rembourser' : 'Net à payer', euros(T.ttc), true);
  } else {
    tot(estAvoir ? 'Montant à rembourser' : 'Total à payer', euros(T.ttc), true);
  }
  y -= 8;

  // ── Paiement, mentions, note ─────────────────────────────────────────────
  for (const l of couper(contenu.paiement, fb, 9.5, W - 2 * M)) { ecrire(l, M, y, { font: fb, t: 9.5 }); y -= 13; }
  y -= 4;
  for (const m of contenu.mentions) for (const l of couper(m, f, 9, W - 2 * M)) { ecrire(l, M, y, { t: 9 }); y -= 12; }
  if (contenu.note) {
    y -= 8;
    const lignesNote = String(contenu.note).split(/\r?\n/).flatMap((p) => couper(p, f, 9, W - 2 * M)).slice(0, 12);
    for (const l of lignesNote) { if (y < M + 40) break; ecrire(l, M, y, { t: 9, couleur: GRIS }); y -= 12; }
  }

  // ── Pied de page : l'identité légale du vendeur ──────────────────────────
  const pied = [v.nom, ...v.legal].join(' · ');
  const lp = couper(pied, f, 7.5, W - 2 * M).slice(0, 3);
  lp.forEach((l, i) => ecrire(l, W / 2, M - 14 + (lp.length - 1 - i) * 10, { t: 7.5, couleur: GRIS, centre: true }));
  return doc.save({ useObjectStreams: false });
}

// Exporté pour l'audit : la mention écrite pour une franchise.
export const _MENTION = MENTION_FRANCHISE;
