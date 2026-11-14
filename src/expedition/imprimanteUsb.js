// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 151 — LE BRANCHEMENT : WebUSB / Web Serial, et le PDF dessiné en points (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Les règles (langages, image, jumelage) sont dans `thermiqueDirecte.js` ; ici seulement
//  ce qui touche le navigateur :
//   · `choisirImprimante` — la fenêtre du NAVIGATEUR où il choisit son imprimante (dans SON
//     toucher : Chrome l'exige). WebUSB d'abord (classe « imprimante » 7, Zebra, TSC) ; Web
//     Serial quand l'imprimante se présente en port série ;
//   · `retrouver` — l'imprimante déjà autorisée, rebranchée (aucune fenêtre : l'autorisation
//     de Chrome reste) — par SES identifiants (fabricant, produit, n° de série), jamais « la
//     première venue » : deux imprimantes branchées et pas de n° de série ⇒ on redemande ;
//   · `envoyer` — les octets par morceaux de 16 Ko, chaque morceau ACCEPTÉ par l'imprimante
//     (un refus s'arrête et se dit, jamais « envoyé » sur un envoi raté) ;
//   · `rasteriserPdf` — chaque page du PDF tamponné dessinée à 203 points par pouce
//     (pdf.js, déjà chargé pour les aperçus), à SA taille, puis en noir et blanc pur ;
//   · `pageEssai` — une étiquette d'essai dessinée ici (aucun bordereau, aucun N° réel).
//  ⚠️ Windows garde souvent l'imprimante pour son propre pilote : Chrome ne peut alors pas
//  la prendre (`occupee`) — l'écran le dit et le PDF prend le relais.
// ════════════════════════════════════════════════════════════════════════════
import { DPI, LARGEUR_MAX_DOTS, dotsDePoints, monochrome, octetsDuLot, langagePropose, fabricantDe, jumelageValide } from './thermiqueDirecte.js';

const MORCEAU = 16384;
const FILTRES_USB = [{ classCode: 7 }, { vendorId: 0x0a5f }, { vendorId: 0x1203 }];
const erreur = (raison, message = '') => { const e = new Error(message || raison); e.raison = raison; return e; };

// Ce que l'écran dit d'une imprimante choisie (avant l'essai) : son nom et le langage proposé.
export function decrireUsb(d) {
  const nom = [d.manufacturerName, d.productName].filter(Boolean).join(' ').trim() || fabricantDe(d.vendorId) || 'Imprimante USB';
  return { voie: 'usb', vendorId: d.vendorId, productId: d.productId, serie: d.serialNumber || '', nom, langage: langagePropose(d.vendorId) };
}
export function decrirePort(p) {
  let info = {}; try { info = p.getInfo ? p.getInfo() : {}; } catch (_) { info = {}; }
  return { voie: 'serie', vendorId: info.usbVendorId || null, productId: info.usbProductId || null, serie: '', nom: fabricantDe(info.usbVendorId) || 'Imprimante (port série)', langage: langagePropose(info.usbVendorId), baud: 9600 };
}

// LA FENÊTRE DU NAVIGATEUR (dans le toucher). Rend { appareil, fiche } ; annulé ⇒ erreur `annule`.
export async function choisirImprimante(nav, voie = 'usb') {
  try {
    if (voie === 'serie') { const p = await nav.serial.requestPort({}); return { appareil: p, fiche: decrirePort(p) }; }
    const d = await nav.usb.requestDevice({ filters: FILTRES_USB });
    return { appareil: d, fiche: decrireUsb(d) };
  } catch (e) { if (e && e.name === 'NotFoundError') throw erreur('annule', e.message); throw e; }
}

// L'imprimante retenue, sans fenêtre. Aucune ⇒ erreur `pasTrouvee` ; deux possibles sans n° de série ⇒ `pasTrouvee` aussi.
export async function retrouver(nav, jumelage) {
  const j = jumelageValide(jumelage);
  if (!j) throw erreur('pasTrouvee');
  if (j.voie === 'usb') {
    const ds = (await nav.usb.getDevices()).filter((d) => d.vendorId === j.vendorId && d.productId === j.productId && (!j.serie || d.serialNumber === j.serie));
    if (ds.length !== 1) throw erreur('pasTrouvee');
    return ds[0];
  }
  const ps = (await nav.serial.getPorts()).filter((p) => { let i = {}; try { i = p.getInfo ? p.getInfo() : {}; } catch (_) {} return (j.vendorId == null || i.usbVendorId === j.vendorId) && (j.productId == null || i.usbProductId === j.productId); });
  if (ps.length !== 1) throw erreur('pasTrouvee');
  return ps[0];
}

// L'interface « imprimante » et son point de sortie (bulk OUT).
function sortieUsb(d) {
  let choix = null;
  for (const it of (d.configuration && d.configuration.interfaces) || []) {
    for (const alt of it.alternates || []) {
      const ep = (alt.endpoints || []).find((e) => e.direction === 'out' && e.type === 'bulk');
      if (!ep) continue;
      const c = { it, alt, ep, rang: alt.interfaceClass === 7 ? 0 : 1 };
      if (!choix || c.rang < choix.rang) choix = c;
    }
  }
  return choix;
}
async function envoyerUsb(d, octets) {
  try {
    if (!d.opened) await d.open();
    if (d.configuration == null) await d.selectConfiguration(1);
  } catch (e) { throw erreur('occupee', e && e.message); }
  const s = sortieUsb(d);
  if (!s) throw erreur('refus', 'aucune sortie');
  try {
    if (!s.it.claimed) await d.claimInterface(s.it.interfaceNumber);
    if (s.alt.alternateSetting) await d.selectAlternateInterface(s.it.interfaceNumber, s.alt.alternateSetting);
  } catch (e) { throw erreur('occupee', e && e.message); }
  let envoyes = 0;
  try {
    for (let o = 0; o < octets.length; o += MORCEAU) {
      const r = await d.transferOut(s.ep.endpointNumber, octets.subarray(o, Math.min(octets.length, o + MORCEAU)));
      if (!r || r.status !== 'ok') throw erreur('refus', r ? r.status : 'transfert');
      envoyes += r.bytesWritten || 0;
    }
  } finally { try { await d.releaseInterface(s.it.interfaceNumber); } catch (_) {} try { await d.close(); } catch (_) {} }
  return envoyes;
}
async function envoyerSerie(p, octets, baud = 9600) {
  try { await p.open({ baudRate: baud }); } catch (e) { if (!(e && e.name === 'InvalidStateError')) throw erreur('occupee', e && e.message); }
  const w = p.writable.getWriter();
  try { for (let o = 0; o < octets.length; o += MORCEAU) await w.write(octets.subarray(o, Math.min(octets.length, o + MORCEAU))); await w.ready; }
  catch (e) { throw erreur('refus', e && e.message); }
  finally { try { w.releaseLock(); } catch (_) {} try { await p.close(); } catch (_) {} }
  return octets.length;
}
// Envoyer des octets à l'appareil (USB ou port) ; rend le nombre d'octets acceptés.
export async function envoyer(appareil, voie, octets, { baud = 9600 } = {}) {
  return voie === 'serie' ? envoyerSerie(appareil, octets, baud) : envoyerUsb(appareil, octets);
}

// ── LE DESSIN ───────────────────────────────────────────────────────────────
// Une page PDF ⇒ { w, h, bits } à 203 dpi, à SA taille (bornée à la largeur de la tête).
// `pdfjs` = la bibliothèque déjà chargée par l'app (chargerPdfjs), `doc` = document.
export async function rasteriserPdf(pdfjs, doc, octets, { seuil, dpi = DPI } = {}) {
  const d = await pdfjs.getDocument({ data: octets.slice ? octets.slice(0) : octets, isEvalSupported: false }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= d.numPages; n++) {
      const pg = await d.getPage(n);
      const v1 = pg.getViewport({ scale: 1 });
      // Une page couchée (plus large que haute) se tourne : l'étiquette sort debout.
      const couchee = v1.width > v1.height * 1.05;
      const largeurPts = couchee ? v1.height : v1.width;
      let w = Math.min(LARGEUR_MAX_DOTS, dotsDePoints(largeurPts, dpi));
      const sc = w / largeurPts;
      const v = pg.getViewport({ scale: sc, rotation: (((pg.rotate | 0) + (couchee ? 90 : 0)) % 360) });
      w = Math.round(v.width); const h = Math.round(v.height);
      const cv = doc.createElement('canvas'); cv.width = w; cv.height = h;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h);
      await pg.render({ canvasContext: c2, viewport: v }).promise;
      pages.push({ w, h, bits: monochrome(c2.getImageData(0, 0, w, h).data, w, h, seuil) });
    }
  } finally { try { await d.destroy(); } catch (_) {} }
  return pages;
}
// LA PAGE D'ESSAI — 100 × 150 mm : un cadre, « VRM · page d'essai », le langage, une règle graduée.
export function pageEssai(doc, { langage = 'tspl', nom = '', textes = {} } = {}) {
  const w = 800, h = 1200;
  const cv = doc.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#000'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24);
  c.fillStyle = '#000'; c.font = 'bold 72px sans-serif'; c.fillText('VRM', 48, 130);
  c.font = 'bold 44px sans-serif'; c.fillText(String(textes.titre || 'Page d’essai'), 48, 210);
  c.font = '34px sans-serif';
  c.fillText(String(nom || '').slice(0, 34), 48, 280);
  c.fillText(`${String(langage).toUpperCase()} · ${DPI} dpi · 100 × 150 mm`, 48, 330);
  c.fillText(String(textes.consigne || '').slice(0, 40), 48, 400);
  for (let x = 48, i = 0; x <= w - 48; x += 40, i++) c.fillRect(x, 1040, 3, i % 5 === 0 ? 60 : 30);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) c.fillRect(520 + x * 28, 520 + y * 28, 28, 28);
  return { w, h, bits: monochrome(c.getImageData(0, 0, w, h).data, w, h) };
}
// Les octets d'un lot, prêts pour le câble.
export const octetsPour = (jumelage, pages) => octetsDuLot(jumelage.langage, pages);
