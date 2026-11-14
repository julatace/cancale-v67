// ── LA CARTE DE REMERCIEMENT À GLISSER DANS LE COLIS (14 nov., lot 130) ─────────
// Julien : « Carte de remerciement à imprimer et à glisser dans le colis, à son nom. »
// « À son nom » = au nom du VENDEUR (sa boutique, sa signature). ⚠️ AUCUNE DONNÉE
// D'ACHETEUR : ni pseudo, ni nom, ni adresse, ni « client fidèle » (§3 : « acheteurs
// fidèles » refusé le 11 oct.). Le contenu est construit par une LISTE BLANCHE de
// ses propres champs ; une vente, un acheteur, une commande ne sont jamais lus.
// Le PDF est fabriqué DANS le navigateur (pdf-lib, déjà dans le dépôt) : rien n'est
// envoyé, il imprime ou télécharge. Format : 4 cartes A6 sur une page A4 (à découper),
// ou une seule carte A6.
export const MERCI_MAX = { signature: 40, boutique: 40, message: 220, lien: 80 };
const net = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// `reglage` : { signature, boutique, message, lien } — SES champs, rien d'autre.
export function contenuCarteMerci(reglage = {}, { messageDefaut = '' } = {}) {
  const r = reglage && typeof reglage === 'object' ? reglage : {};
  return {
    signature: net(r.signature, MERCI_MAX.signature),
    boutique: net(r.boutique, MERCI_MAX.boutique),
    message: net(r.message, MERCI_MAX.message) || net(messageDefaut, MERCI_MAX.message),
    lien: /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/[\w./%-]*)?$/i.test(net(r.lien, MERCI_MAX.lien)) ? net(r.lien, MERCI_MAX.lien) : '',
  };
}

// Le PDF : `parPage` 4 (A4, 4 cartes A6) ou 1 (A6). `titre` : le mot « Merci » dans sa langue.
const A4 = [595.28, 841.89], A6 = [297.64, 419.53];
export async function pdfCarteMerci(contenu, { PDFLib = null, parPage = 4, titre = 'Merci' } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(titre); doc.setCreator('VRM'); doc.setProducer('VRM (pdf-lib)');
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold), fi = await doc.embedFont(StandardFonts.HelveticaOblique);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.45, 0.45, 0.48), FILET = rgb(0.82, 0.82, 0.85);
  const dessinable = (font, ch) => { try { font.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (font, s) => { let o = ''; for (const ch of String(s || '').replace(/[‘’]/g, "'").replace(/[«»“”]/g, '"').replace(/[−–—]/g, '-').replace(/…/g, '...')) o += dessinable(font, ch) ? ch : (dessinable(font, ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  // Coupe un texte en lignes qui tiennent dans `max`.
  const lignes = (font, t, taille, max) => { const mots = propre(font, t).split(' '); const out = []; let l = ''; for (const m of mots) { const e = l ? l + ' ' + m : m; if (font.widthOfTextAtSize(e, taille) > max && l) { out.push(l); l = m; } else l = e; } if (l) out.push(l); return out.slice(0, 6); };
  const carte = (page, x, y, w, h) => {
    const cx = x + w / 2;
    const centre = (font, t, taille, yy, c = ENCRE) => { const v = propre(font, t); page.drawText(v, { x: cx - font.widthOfTextAtSize(v, taille) / 2, y: yy, size: taille, font, color: c }); };
    let yy = y + h - 92;
    centre(fb, titre, 34, yy); yy -= 40;
    for (const l of lignes(fi, contenu.message, 12, w - 56)) { centre(fi, l, 12, yy, ENCRE); yy -= 17; }
    yy -= 18;
    if (contenu.signature) { centre(fb, contenu.signature, 13, yy); yy -= 18; }
    if (contenu.boutique) { centre(f, contenu.boutique, 10.5, yy, GRIS); yy -= 15; }
    if (contenu.lien) centre(f, contenu.lien, 9.5, y + 28, GRIS);
  };
  if (parPage === 1) {
    const page = doc.addPage(A6);
    carte(page, 0, 0, A6[0], A6[1]);
  } else {
    const page = doc.addPage(A4);
    const [W, H] = A4, w = W / 2, h = H / 2;
    for (let i = 0; i < 4; i++) carte(page, (i % 2) * w, (i < 2 ? h : 0), w, h);
    // Les traits de coupe, fins.
    page.drawLine({ start: { x: w, y: 12 }, end: { x: w, y: H - 12 }, thickness: 0.4, color: FILET, dashArray: [3, 4] });
    page.drawLine({ start: { x: 12, y: h }, end: { x: W - 12, y: h }, thickness: 0.4, color: FILET, dashArray: [3, 4] });
  }
  return doc.save();
}
