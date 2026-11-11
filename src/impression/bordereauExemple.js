// ── UN BORDEREAU INVENTÉ (11 nov., lot thermique) ──────────────────────────
// Le dépôt est PUBLIC : aucun vrai bordereau n'y entre. L'aperçu de Paramètres →
// Impression des bordereaux, et le banc `thermique.cjs`, fabriquent ici des
// bordereaux de la MÊME FORME que ceux de Vinted / Mondial Relay / Relais Colis /
// Chronopost / Colissimo / InPost : un vrai code-barres (2 parmi 5 entrelacé,
// lisible), un vrai QR (qrcode-generator), une adresse INVENTÉE, la notice et la
// fiche destinataire autour. Rien n'y est vrai sauf la forme.
//
// `PL` : pdf-lib ; `qrcode` : qrcode-generator (passés par l'appelant : l'app et
// le banc n'ont pas le même chargeur).

export const ADRESSE_INVENTEE = Object.freeze(['Jeanne Exemple', '12 allée Imaginaire', 'Bâtiment B', '75000 PARIS', 'FRANCE']);
export const EXPEDITEUR_INVENTE = Object.freeze(['Vendeur Exemple', '3 allée des Essais', '35000 RENNES']);

// 2 parmi 5 entrelacé (ITF) : n = barre fine, w = large (2,5 × la fine).
export const ITF = Object.freeze(['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn']);
// La suite des éléments (barre, espace, barre…) : [{ noir, large }].
export function elementsITF(chiffres) {
  const d = String(chiffres).replace(/\D/g, '');
  if (!d || d.length % 2) throw Error('ITF : un nombre PAIR de chiffres');
  const el = [];
  const pose = (noir, c) => el.push({ noir, large: c === 'w' });
  pose(true, 'n'); pose(false, 'n'); pose(true, 'n'); pose(false, 'n');                     // départ
  for (let i = 0; i < d.length; i += 2) { const a = ITF[+d[i]], b = ITF[+d[i + 1]]; for (let k = 0; k < 5; k++) { pose(true, a[k]); pose(false, b[k]); } }
  pose(true, 'w'); pose(false, 'n'); pose(true, 'n');                                       // fin
  return el;
}
// Lit une suite de passages (longueurs, en commençant par une BARRE) : les chiffres, ou null.
export function lireITF(passages) {
  const r = passages.slice();
  if (r.length < 4 + 10 + 3) return null;
  const fin = (Math.min(r[0], r[1], r[2], r[3]) + Math.max(r[0], r[1], r[2], r[3])) / 2;
  const seuil = fin * 1.7;
  const e = r.map((x) => (x > seuil ? 'w' : 'n'));
  if (e.slice(0, 4).join('') !== 'nnnn') return null;
  const corps = e.slice(4, e.length - 3);
  if (e.slice(-3).join('') !== 'wnn' || corps.length % 10) return null;
  let out = '';
  for (let i = 0; i < corps.length; i += 10) {
    let a = '', b = ''; for (let k = 0; k < 5; k++) { a += corps[i + 2 * k]; b += corps[i + 2 * k + 1]; }
    const x = ITF.indexOf(a), y = ITF.indexOf(b); if (x < 0 || y < 0) return null; out += x + '' + y;
  }
  return out;
}
// Dessine le code : `X` = la barre fine (points), hauteur `h`, coin bas-gauche (x, y).
// Rend la largeur dessinée (zones de silence de 10 X comprises).
export function dessinerITF(page, PL, chiffres, x, y, X, h) {
  const noir = PL.rgb(0, 0, 0); let cx = x + 10 * X;
  for (const el of elementsITF(chiffres)) { const w = el.large ? 2.5 * X : X; if (el.noir) page.drawRectangle({ x: cx, y, width: w, height: h, color: noir }); cx += w; }
  return cx + 10 * X - x;
}
export const largeurITF = (chiffres, X) => { let w = 20 * X; for (const el of elementsITF(chiffres)) w += el.large ? 2.5 * X : X; return w; };
// Un QR (texte), coin bas-gauche (x, y), case de `mod` points. Rend le côté dessiné.
export function dessinerQR(page, PL, qrcode, texte, x, y, mod) {
  const q = qrcode(0, 'M'); q.addData(texte); q.make();
  const n = q.getModuleCount(), noir = PL.rgb(0, 0, 0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) page.drawRectangle({ x: x + c * mod, y: y + (n - 1 - r) * mod, width: mod, height: mod, color: noir });
  return n * mod;
}

// L'étiquette elle-même dans le repère (ox, oy) de taille w × h (points).
// `o` : { transporteur, suivi (chiffres pairs), qr (texte), X (barre fine), gris (une
// mention gris clair, comme les vraies) }.
export function dessinerEtiquette(page, PL, qrcode, f, fb, ox, oy, w, h, o = {}) {
  const noir = PL.rgb(0, 0, 0), gris = PL.rgb(0.55, 0.55, 0.55);
  const T = (t, x, y, s, font = f, color = noir) => page.drawText(t, { x, y, size: s, font, color });
  const m = Math.max(8, w * 0.04);
  // `plein` : tout le blanc de l'étiquette est couvert de texte, SAUF autour des codes et de
  // l'adresse (un fond blanc sous chacun) — il n'y reste aucune place sûre pour un tampon.
  const blanc = PL.rgb(1, 1, 1), sousBlanc = (x, y, ww, hh) => { if (o.plein) page.drawRectangle({ x, y, width: ww, height: hh, color: blanc }); };
  if (o.plein) { const t = 'Agence 24R · Tournée 12 · Réf 000123 · Colis 1/1 · '; for (let yy = oy + h - 10; yy > oy + 4; yy -= 8) { let ss = t; while (f.widthOfTextAtSize(ss, 6.5) < w - 8) ss += t; while (ss.length > 1 && f.widthOfTextAtSize(ss, 6.5) > w - 8) ss = ss.slice(0, -1); page.drawText(ss, { x: ox + 4, y: yy, size: 6.5, font: f, color: noir }); } }
  page.drawRectangle({ x: ox + 2, y: oy + 2, width: w - 4, height: h - 4, borderColor: noir, borderWidth: 1 });
  T(o.transporteur || 'Mondial Relay', ox + m, oy + h - m - 14, 14, fb);
  T(o.service || 'Point Relais · 24R', ox + w - m - fb.widthOfTextAtSize(o.service || 'Point Relais · 24R', 9), oy + h - m - 12, 9, fb);
  const suivi = o.suivi || '12345678901234';
  const X = o.X || 1.1, bh = Math.min(56, h * 0.16);
  const lw = largeurITF(suivi, X), bx = ox + (w - lw) / 2;
  sousBlanc(bx, oy + h - m - 30 - bh, lw, bh + 8);
  dessinerITF(page, PL, suivi, bx, oy + h - m - 26 - bh, X, bh);
  const lib = suivi.replace(/(\d{4})(?=\d)/g, '$1 ');
  T(lib, ox + (w - f.widthOfTextAtSize(lib, 10)) / 2, oy + h - m - 40 - bh, 10);
  let y = oy + h - m - 62 - bh;
  sousBlanc(ox + m - 3, y - 13 * ADRESSE_INVENTEE.length - 4, fb.widthOfTextAtSize(ADRESSE_INVENTEE[0], 11) + 70, 13 * ADRESSE_INVENTEE.length + 14);
  T('Destinataire', ox + m, y, 8, fb, gris); y -= 13;
  for (const l of ADRESSE_INVENTEE) { T(l, ox + m, y, 11, l === ADRESSE_INVENTEE[0] ? fb : f); y -= 13; }
  const mod = o.mod || Math.max(2.2, Math.min(3.2, w / 110));
  sousBlanc(ox + w - m - 33 * mod, oy + m + 26, 37 * mod, 37 * mod);
  // `blancQr` (points) : un blanc AU-DESSUS du QR, collé à lui — assez grand pour un tampon
  // seulement si l'on oublie la garde de 5 mm autour des codes (le banc s'en sert pour le prouver).
  if (o.plein && o.blancQr) page.drawRectangle({ x: ox + w * 0.56, y: oy + m + 26, width: w * 0.44 - m, height: 33 * mod + 4 + o.blancQr, color: blanc });
  const cote = dessinerQR(page, PL, qrcode, o.qr || `VRM-EXEMPLE-${suivi}`, ox + w - m - 29 * mod, oy + m + 30, mod);
  y = oy + m + 30 + cote - 8;
  T('Expéditeur', ox + m, y, 7, fb, gris); y -= 10;
  for (const l of EXPEDITEUR_INVENTE) { T(l, ox + m, y, 8); y -= 10; }
  T('24R', ox + m, oy + m + 4, 26, fb);
  if (o.gris !== false) T('Poids 0,5 kg · Colis 1/1', ox + m + 70, oy + m + 8, 7, f, gris);
}
// La notice / la fiche destinataire / la pub (ce que la découpe doit laisser).
export function dessinerNotice(page, PL, f, fb, ox, oy, w, h, titre = 'Comment utiliser votre étiquette') {
  const noir = PL.rgb(0, 0, 0);
  page.drawText(titre, { x: ox + 12, y: oy + h - 28, size: 14, font: fb, color: noir });
  const lignes = ['1. On imprime cette page.', '2. On découpe votre étiquette en suivant les pointillés.', '3. On colle l’étiquette sur le colis.', 'Fiche destinataire : à glisser à l’intérieur du colis.', 'Dimensions max : 120 cm.', 'Trouvez vos points de proximité.'];
  lignes.forEach((l, i) => page.drawText(l, { x: ox + 12, y: oy + h - 52 - i * 16, size: 10, font: f, color: noir }));
}
const pointilles = (page, PL, x1, y1, x2, y2) => { const n = Math.hypot(x2 - x1, y2 - y1), pas = 8; for (let t = 0; t < n; t += pas) { const a = t / n, b = Math.min(1, (t + pas / 2) / n); page.drawLine({ start: { x: x1 + (x2 - x1) * a, y: y1 + (y2 - y1) * a }, end: { x: x1 + (x2 - x1) * b, y: y1 + (y2 - y1) * b }, thickness: 0.6, color: PL.rgb(0, 0, 0) }); } };

// Les mises en page fabriquées. `mise` :
//   'a4-notice'   A4 debout, notice en haut, étiquette 10×15 en bas (Mondial Relay / Vinted)
//   'a4-colonnes' A4 couchée, fiche à gauche, étiquette à droite (Chronopost)
//   'a4-2'        A4 debout, DEUX étiquettes 10×15 côte à côte, la notice dessous, pointillés
//   'a4-4'        A4 debout, QUATRE étiquettes (quarts), pointillés en croix
//   '10x15'       la page EST l'étiquette (Colissimo, InPost)
//   '10x15-couchee' 150×100 couchée (Relais Colis)
//   '10x15-plein' la 10×15 sans aucun blanc hors des codes et de l'adresse
export async function fabriquerBordereau(PL, qrcode, mise = 'a4-notice', o = {}) {
  const d = await PL.PDFDocument.create();
  const f = await d.embedFont(PL.StandardFonts.Helvetica), fb = await d.embedFont(PL.StandardFonts.HelveticaBold);
  const A4 = [595.28, 841.89], E = [283.46, 425.2];
  const et = (p, x, y, w, h, i = 0) => dessinerEtiquette(p, PL, qrcode, f, fb, x, y, w, h, { ...o, suivi: (o.suivi || '12345678901234').slice(0, -2) + String(10 + i).slice(-2) });
  if (mise === '10x15') { const p = d.addPage(E); et(p, 0, 0, E[0], E[1]); }
  else if (mise === '10x15-plein') { const p = d.addPage(E); dessinerEtiquette(p, PL, qrcode, f, fb, 0, 0, E[0], E[1], { ...o, plein: true, suivi: (o.suivi || '12345678901234').slice(0, -2) + '10' }); }
  else if (mise === '10x15-couchee') { const p = d.addPage([E[1], E[0]]); et(p, 0, 0, E[1], E[0]); }
  else if (mise === 'a4-colonnes') { const p = d.addPage([A4[1], A4[0]]); dessinerNotice(p, PL, f, fb, 20, 40, 360, 520, 'Fiche destinataire'); et(p, 425, 20, 400, 555); }
  else if (mise === 'a4-2') { const p = d.addPage(A4); et(p, 10, 400, E[0], E[1], 0); et(p, 302, 400, E[0], E[1], 1); pointilles(p, PL, 297.6, 380, 297.6, 837); dessinerNotice(p, PL, f, fb, 30, 30, 535, 320, 'Comment utiliser vos étiquettes'); pointilles(p, PL, 10, 370, 585, 370); }
  else if (mise === 'a4-4') { const p = d.addPage(A4); const w = 297.6, h = 420.9; for (let i = 0; i < 4; i++) et(p, (i % 2) * w + 8, (i < 2 ? h : 0) + 8, w - 16, h - 16, i); pointilles(p, PL, w, 5, w, 837); pointilles(p, PL, 5, h, 590, h); }
  else { const p = d.addPage(A4); dessinerNotice(p, PL, f, fb, 30, 470, 535, 340); pointilles(p, PL, 10, 450, 585, 450); et(p, 155, 20, E[0], E[1]); }
  return d.save();
}
