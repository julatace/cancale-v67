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
import { bi, EN, paiementAnglais } from './anglais.js';

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
  // (10 nov., lot T) Facture en anglais : chaque libellé « français / English »,
  // même taille, le français d'abord (./anglais.js dit pourquoi).
  const en = !!contenu.anglais;
  const B = (fr) => bi(fr, en);

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

  // ── (16 nov., lot factures-mieux) L'EN-TÊTE : un bandeau à la couleur du vendeur ──
  // Même charte que le reçu d'achat (Julien, 16 nov. : « je veux que ça soit comme ça ») :
  // un bandeau sobre (sa couleur, texte blanc) — à gauche le type de document en petites
  // capitales et SON nom (ou son logo sur une pastille blanche), à droite le numéro et la
  // date d'émission ; puis le montant EN GRAND ; puis vendeur | acheteur, la vente, le
  // tableau, les totaux, le paiement, les mentions, le pied. Avant : rien en haut à gauche
  // sans logo, et la date de vente, la nature et la référence sur une ligne grise coupée.
  const BLANC = [1, 1, 1];
  const hBande = 92;
  page.drawRectangle({ x: 0, y: H - hBande, width: W, height: hBande, color: c(accent) });
  let yb = H - 34;
  ecrire(B(estAvoir ? 'AVOIR' : 'FACTURE').toUpperCase(), M, yb, { font: fb, t: 8.5, couleur: BLANC });
  let logoPose = false;
  if (contenu.logo) {
    try {
      const b64 = contenu.logo.split(',')[1] || '';
      const octets = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64') : Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
      const img = /^data:image\/png/.test(contenu.logo) ? await doc.embedPng(octets) : await doc.embedJpg(octets);
      const k = Math.min(140 / img.width, 34 / img.height, 1);
      const w = img.width * k, h = img.height * k;
      page.drawRectangle({ x: M - 6, y: H - hBande + 10, width: w + 12, height: h + 12, color: c(BLANC) });
      page.drawImage(img, { x: M, y: H - hBande + 16, width: w, height: h });
      logoPose = true;
    } catch (_) { logoPose = false; }
  }
  const colG = (W - 2 * M) * 0.56;
  if (!logoPose) couper(contenu.vendeur.nom, fb, 17, colG).slice(0, 2).forEach((l, i) => ecrire(l, M, yb - 24 - i * 19, { font: fb, t: 17, couleur: BLANC }));
  ecrire(`N° ${contenu.numero}`, W - M, yb, { font: fb, t: 12, couleur: BLANC, droite: true });
  ecrire(`${B("Date d'émission")} : ${contenu.emiseJour}`, W - M, yb - 18, { t: 9.5, couleur: BLANC, droite: true });
  if (estAvoir && contenu.origine) ecrire(`${B('Annule la facture')} ${contenu.origine}`, W - M, yb - 32, { t: 9.5, couleur: BLANC, droite: true });
  let y = H - hBande - 34;

  // ── Le montant, en grand (la dernière ligne des totaux, ni recalculée ni arrondie) ──
  const T0 = contenu.totaux;
  const libGrand = contenu.regime === 'normal' ? (estAvoir ? 'Total TTC à rembourser' : 'Total TTC') : contenu.regime === 'franchise' ? (estAvoir ? 'Montant à rembourser' : 'Net à payer') : (estAvoir ? 'Montant à rembourser' : 'Total à payer');
  ecrire(B(libGrand), M, y + 2, { font: fb, t: 11, couleur: GRIS });
  ecrire(euros(T0.ttc), W - M - 6, y, { font: fb, t: 22, droite: true });
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: c(FILET) });
  y -= 24;

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
  const y1 = bloc(B('VENDEUR'), v.nom, [...v.adresse, ...v.legal, v.email, v.telephone], M);
  const y2 = bloc(B(estAvoir ? 'CLIENT' : 'FACTURÉ À'), a.nom, [...a.adresse, a.email], M + col + 24);
  y = Math.min(y1, y2) - 18;

  // ── La vente : une étiquette grise, puis la valeur — une ligne chacune ──────
  const infos = [[B('Date de la vente'), contenu.venteJour], [B('Nature'), en && EN[contenu.nature] ? `${contenu.nature} / ${EN[contenu.nature]}` : contenu.nature], ...(contenu.reference ? [[B('Référence'), contenu.reference]] : [])];
  const largEtiq = Math.max(...infos.map(([k]) => larg(propre(k), f, 9))) + 14;
  for (const [k, val] of infos) {
    ecrire(k, M, y, { t: 9, couleur: GRIS });
    const ls = couper(val, f, 9, W - 2 * M - largEtiq);
    ls.forEach((l, i) => ecrire(l, M + largEtiq, y - i * 12, { t: 9 }));
    y -= 12 * ls.length + 2;
  }
  y -= 12;

  // ── Le tableau ───────────────────────────────────────────────────────────
  const marge = contenu.regime === 'marge';
  const cols = { des: M, qte: W - M - 200, pu: W - M - 95, tot: W - M };
  // Bilingue : l'en-tête du tableau sur deux lignes (français, puis anglais à la même taille).
  const hEnt = en ? 11 : 0;
  page.drawRectangle({ x: M, y: y - 6 - hEnt, width: W - 2 * M, height: 20 + hEnt, color: c(accent), opacity: 0.08 });
  page.drawLine({ start: { x: M, y: y - 6 - hEnt }, end: { x: W - M, y: y - 6 - hEnt }, thickness: 1, color: c(accent) });
  const entete = (fr, x, o) => { ecrire(fr, x, y, o); if (en && EN[fr]) ecrire(EN[fr], x, y - 11, o); };
  entete('Désignation', cols.des + 6, { font: fb, t: 9 });
  entete('Qté', cols.qte, { font: fb, t: 9, droite: true });
  entete(marge ? 'Prix unitaire' : 'Prix unit. HT', cols.pu, { font: fb, t: 9, droite: true });
  entete(marge ? 'Total' : 'Total HT', cols.tot - 6, { font: fb, t: 9, droite: true });
  y -= 24 + hEnt;
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
  // Bilingue : le libellé anglais sous le français, à la même taille.
  const tot = (lib0, val0, gras = false) => {
    const o = { font: gras ? fb : f, t: gras ? 11 : 9.5 };
    const [fr, ...reste] = String(lib0).split(' ');
    const cle = EN[lib0] ? lib0 : EN[fr] ? fr : '';
    ecrire(lib0, xL, y, o); ecrire(val0, xR, y, { ...o, droite: true });
    if (en && cle) { y -= gras ? 13 : 11.5; ecrire([EN[cle], ...(cle === fr ? reste : [])].join(' '), xL, y, o); if (val0 === 'non applicable') ecrire(EN[val0], xR, y, { ...o, droite: true }); }
    y -= gras ? 18 : 14;
  };
  const T = contenu.totaux;
  if (contenu.regime === 'normal') {
    tot('Total HT', euros(T.ht));
    tot(`TVA ${String(contenu.taux).replace('.', ',')}\u00a0%`, euros(T.tva));
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
  if (en) for (const l of couper(paiementAnglais(contenu), fb, 9.5, W - 2 * M)) { ecrire(l, M, y, { font: fb, t: 9.5 }); y -= 13; }
  y -= 4;
  // La mention légale reste MOT POUR MOT en français ; sa traduction juste après.
  contenu.mentions.forEach((m, i) => {
    for (const l of couper(m, f, 9, W - 2 * M)) { ecrire(l, M, y, { t: 9 }); y -= 12; }
    const t = en && contenu.anglais.mentions ? contenu.anglais.mentions[i] : '';
    if (t) for (const l of couper(t, f, 9, W - 2 * M)) { ecrire(l, M, y, { t: 9 }); y -= 12; }
  });
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
