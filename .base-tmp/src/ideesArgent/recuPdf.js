// Le reçu d'une vente en main propre (160), dessiné DANS le navigateur (pdf-lib, chargé à la
// demande). Rien de l'acheteur (VRM ne le connaît pas), aucun prix d'achat : `lignesRecu`
// (src/ideesArgent/venteMain.js) a déjà choisi ce qui y figure. Les libellés viennent de
// l'appelant (`tr()`, la langue de VRM). Rend un Uint8Array (le PDF) ou null.
const sur = (s) => String(s == null ? '' : s).replace(/[  ]/g, ' ').replace(/[^\x20-\x7e -ÿ’–—€Œœ…]/g, '');

export async function recuPdf(recu, mots) {
  if (!recu || !mots) return null;
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(sur(mots.titre)); doc.setCreator('VRM'); doc.setProducer('VRM');
  const page = doc.addPage([420, 595]);   // A5
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const encre = rgb(0.047, 0.114, 0.188), gris = rgb(0.247, 0.329, 0.408);
  let y = 540;
  page.drawText(sur(mots.titre), { x: 40, y, size: 22, font: fb, color: encre });
  y -= 22;
  if (recu.numeroRecu) { page.drawText(sur(`${mots.numero} ${recu.numeroRecu}`), { x: 40, y, size: 10, font: f, color: gris }); y -= 14; }
  page.drawText(sur(mots.sousTitre), { x: 40, y, size: 10, font: f, color: gris });
  y -= 34;
  const ligne = (lib, val, gras = false) => {
    page.drawText(sur(lib), { x: 40, y, size: 10, font: f, color: gris });
    const v = sur(val) || '—';
    const taille = gras ? 18 : 12, police = gras ? fb : f;
    const lignes = []; let l = '';
    for (const m of v.split(' ')) { const e = l ? l + ' ' + m : m; if (police.widthOfTextAtSize(e, taille) > 220 && l) { lignes.push(l); l = m; } else l = e; }
    if (l) lignes.push(l);
    lignes.slice(0, 3).forEach((t, i) => page.drawText(t, { x: 150, y: y - i * (taille + 3), size: taille, font: police, color: encre }));
    y -= Math.max(1, Math.min(3, lignes.length)) * (taille + 3) + 14;
  };
  ligne(mots.date, recu.date);
  ligne(mots.vendeur, recu.vendeur || '______________________________');
  ligne(mots.article, recu.article);
  if (recu.numero) ligne(mots.rangement, 'N°' + recu.numero);
  ligne(mots.paiement, mots.modes[recu.paiement] || recu.paiement);
  const m = Number(recu.montant);
  ligne(mots.montant, (m % 1 === 0 ? String(m) : m.toFixed(2).replace('.', ',')) + ' €', true);
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 0.5, color: gris });
  y -= 18;
  for (const t of String(mots.pied || '').split('\n')) { page.drawText(sur(t), { x: 40, y, size: 9, font: f, color: gris }); y -= 13; }
  y -= 30;
  page.drawText(sur(mots.signature), { x: 40, y, size: 9, font: f, color: gris });
  return doc.save();
}
