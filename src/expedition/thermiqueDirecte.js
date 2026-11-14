// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 151 — L'IMPRESSION DIRECTE SUR L'IMPRIMANTE THERMIQUE (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Demande : « sur ordinateur avec Chrome/Edge, imprimer les bordereaux SANS la fenêtre
//  d'impression, directement sur l'imprimante thermique 4×6 / 100×150 ; jumelée une fois ».
//
//  Ce fichier porte les RÈGLES, pures (aucun DOM, aucun navigateur, aucune requête) :
//   · le passage d'une image (RGBA) en points noirs et blancs (`monochrome`) — la tête
//     thermique ne sait faire que « chauffer » ou « ne pas chauffer » un point ;
//   · les trois langages courants des imprimantes d'étiquettes, octet par octet :
//       ZPL   (Zebra et ses compatibles)     `^XA … ^GFA … ^XZ`
//       TSPL  (TSC, et la plupart des 4×6 bon marché : Munbyn, iDPRT, Xprinter, Rollo…)
//             `SIZE … BITMAP … PRINT`
//       ESC/POS (imprimantes de tickets)     `GS v 0 … GS V`
//   · le langage PROPOSÉ d'après le fabricant lu sur le câble USB (deux fabricants sûrs :
//     Zebra ⇒ ZPL, TSC ⇒ TSPL) ; sinon TSPL, et la page d'essai tranche (« elle est
//     sortie ? » ; « non » ⇒ le langage suivant). Rien n'est retenu avant SON « oui » ;
//   · le jumelage RETENU (sur CET appareil seulement : un câble USB se branche sur un
//     ordinateur, pas sur un compte) et la voie de l'impression (directe ou le PDF).
//  Le branchement réel (WebUSB / Web Serial, le rendu PDF → image) vit dans
//  `imprimanteUsb.js` ; l'écran dans `ImprimanteDirecte.jsx`.
//
//  ⚠️ Gratuit, aucun service tiers : le PDF est dessiné DANS le navigateur (pdf.js, déjà là
//  pour les aperçus), les octets partent par le câble. Aucun octet ne quitte l'ordinateur.
//  ⚠️ Sans WebUSB ni Web Serial (Safari, iPhone, Firefox), ou si la page n'y a pas droit
//  (en-tête Permissions-Policy), c'est le parcours PDF normal — sans erreur, dit en une ligne.
// ════════════════════════════════════════════════════════════════════════════

export const DPI = 203;                       // la tête courante des 4×6 : 8 points par mm
export const SEUIL_DEFAUT = 150;              // luminance sous laquelle un point est noir (la règle « noir pur » de thermique.js)
export const LANGAGES = Object.freeze(['tspl', 'zpl', 'escpos']);
export const CLE_IMPRIMANTE_DIRECTE = 'vrm_imprimante_directe';   // sur l'appareil, jamais synchronisée
export const LARGEUR_MAX_DOTS = 832;          // tête de 104 mm à 203 dpi : au-delà, l'imprimante coupe

// Les fabricants dont le langage est SÛR (identifiant USB du fabricant).
export const FABRICANTS = Object.freeze({
  0x0a5f: { nom: 'Zebra', langage: 'zpl' },
  0x1203: { nom: 'TSC', langage: 'tspl' },
});
export const langagePropose = (vendorId) => (FABRICANTS[vendorId] ? FABRICANTS[vendorId].langage : 'tspl');
export const fabricantDe = (vendorId) => (FABRICANTS[vendorId] ? FABRICANTS[vendorId].nom : '');
// Après un « non, rien n'est sorti correctement » : le langage suivant (jamais le même deux fois de suite).
export const langageSuivant = (l) => LANGAGES[(Math.max(0, LANGAGES.indexOf(l)) + 1) % LANGAGES.length];

export const dotsDePoints = (pts, dpi = DPI) => Math.max(8, Math.round((Number(pts) || 0) / 72 * dpi));
export const dotsDeMm = (mm, dpi = DPI) => Math.max(8, Math.round((Number(mm) || 0) / 25.4 * dpi));
export const octetsParLigne = (w) => Math.ceil(w / 8);

// ── L'IMAGE EN POINTS ────────────────────────────────────────────────────────
// `rgba` : Uint8ClampedArray (canvas.getImageData), `w`×`h`. Rendu : lignes de
// `octetsParLigne(w)` octets, bit de poids fort à gauche, 1 = point NOIR (chauffé).
// Un point transparent est blanc (le papier).
export function monochrome(rgba, w, h, seuil = SEUIL_DEFAUT) {
  const rb = octetsParLigne(w);
  const bits = new Uint8Array(rb * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3];
      if (a < 128) continue;
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (lum < seuil) bits[y * rb + (x >> 3)] |= (0x80 >> (x & 7));
    }
  }
  return bits;
}
// Combien de points noirs dans un rectangle (en points) — pour les contrôles (tampon présent).
export function encreDans(bits, w, h, { x = 0, y = 0, l = w, ht = h } = {}) {
  const rb = octetsParLigne(w); let n = 0;
  for (let j = Math.max(0, y); j < Math.min(h, y + ht); j++) for (let i = Math.max(0, x); i < Math.min(w, x + l); i++) if (bits[j * rb + (i >> 3)] & (0x80 >> (i & 7))) n++;
  return n;
}

const ascii = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
const concat = (parts) => { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const HEX = '0123456789ABCDEF';

// ── ZPL : une étiquette = ^XA … ^XZ, l'image en ^GFA (hexadécimal, sans compression) ──
export function etiquetteZpl({ w, h, bits }) {
  const rb = octetsParLigne(w), total = rb * h;
  let hex = '';
  const morceaux = [];
  for (let i = 0; i < total; i++) { const b = bits[i]; hex += HEX[b >> 4] + HEX[b & 15]; if (hex.length >= 65536) { morceaux.push(hex); hex = ''; } }
  morceaux.push(hex);
  return concat([ascii(`^XA^PW${rb * 8}^LL${h}^LH0,0^FO0,0^GFA,${total},${total},${rb},`), ...morceaux.map(ascii), ascii('^FS^PQ1^XZ\n')]);
}
// ── TSPL : SIZE / GAP / CLS / BITMAP (binaire : en TSPL un bit À 0 imprime) / PRINT ──
export function etiquetteTspl({ w, h, bits }, { mmL = null, mmH = null, dpi = DPI } = {}) {
  const rb = octetsParLigne(w);
  const L = mmL || Math.round((rb * 8) / dpi * 25.4), Hm = mmH || Math.round(h / dpi * 25.4);
  const inv = new Uint8Array(bits.length);
  for (let i = 0; i < bits.length; i++) inv[i] = (~bits[i]) & 0xff;
  return concat([ascii(`SIZE ${L} mm,${Hm} mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,${rb},${h},0,`), inv, ascii('\r\nPRINT 1,1\r\n')]);
}
// ── ESC/POS : ESC @, GS v 0 (1 = noir), avance et coupe ──
export function etiquetteEscpos({ w, h, bits }) {
  const rb = octetsParLigne(w);
  const parts = [Uint8Array.of(0x1b, 0x40)];
  // Par bandes de 1 000 lignes au plus (certaines têtes refusent une image plus haute en une fois).
  for (let y0 = 0; y0 < h; y0 += 1000) {
    const hh = Math.min(1000, h - y0);
    parts.push(Uint8Array.of(0x1d, 0x76, 0x30, 0x00, rb & 0xff, (rb >> 8) & 0xff, hh & 0xff, (hh >> 8) & 0xff));
    parts.push(bits.subarray(y0 * rb, (y0 + hh) * rb));
  }
  parts.push(Uint8Array.of(0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00));
  return concat(parts);
}
// Le lot : une étiquette par page, dans l'ordre, dans le langage retenu.
export function octetsDuLot(langage, pages, opts = {}) {
  const l = LANGAGES.includes(langage) ? langage : 'tspl';
  const un = l === 'zpl' ? etiquetteZpl : l === 'escpos' ? etiquetteEscpos : (p) => etiquetteTspl(p, opts);
  return concat((pages || []).map((p) => un(p)));
}

// ── LE JUMELAGE RETENU (sur cet appareil) ───────────────────────────────────
// { voie: 'usb'|'serie', vendorId, productId, serie, nom, langage, essaiOk: true, at }
// Rien d'autre n'est cru : une valeur étrange ⇒ pas de jumelage (on redemande, jamais on devine).
export function jumelageValide(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (v.voie !== 'usb' && v.voie !== 'serie') return null;
  if (!LANGAGES.includes(v.langage) || v.essaiOk !== true) return null;
  const vid = Number(v.vendorId), pid = Number(v.productId);
  if (v.voie === 'usb' && !(Number.isInteger(vid) && vid > 0 && Number.isInteger(pid) && pid >= 0)) return null;
  return { voie: v.voie, vendorId: Number.isInteger(vid) ? vid : null, productId: Number.isInteger(pid) ? pid : null, serie: typeof v.serie === 'string' ? v.serie.slice(0, 80) : '',
    nom: String(v.nom || '').slice(0, 60), langage: v.langage, essaiOk: true, at: Number(v.at) || 0, baud: Number(v.baud) || 9600 };
}

// ── CE QUE LE NAVIGATEUR PERMET ─────────────────────────────────────────────
// `nav` = navigator, `doc` = document (injectés : les audits passent les leurs).
// ⇒ { usb, serie, raison } — raison : '' (au moins une voie), 'navigateur' (ni WebUSB ni
// Web Serial : Safari, iPhone, Firefox), 'politique' (la page n'y a pas droit : en-tête
// Permissions-Policy `usb=()`).
export function voiesDisponibles(nav, doc) {
  const politique = (f) => { try { const p = doc && (doc.permissionsPolicy || doc.featurePolicy); return p && typeof p.allowsFeature === 'function' ? !!p.allowsFeature(f) : true; } catch (_) { return true; } };
  const aUsb = !!(nav && nav.usb && typeof nav.usb.requestDevice === 'function');
  const aSerie = !!(nav && nav.serial && typeof nav.serial.requestPort === 'function');
  const usb = aUsb && politique('usb'), serie = aSerie && politique('serial');
  return { usb, serie, raison: usb || serie ? '' : (aUsb || aSerie ? 'politique' : 'navigateur') };
}
// LA VOIE D'UNE IMPRESSION : 'directe' seulement pour le papier thermique, une imprimante
// jumelée (essai réussi) ET une voie ouverte pour elle ; sinon le PDF, avec la raison.
export function voieImpressionDirecte({ format, jumelage, voies }) {
  if (format !== 'thermique') return { voie: 'pdf', raison: 'format' };
  const j = jumelageValide(jumelage);
  const v = voies || { usb: false, serie: false, raison: 'navigateur' };
  if (!v.usb && !v.serie) return { voie: 'pdf', raison: v.raison || 'navigateur' };
  if (!j) return { voie: 'pdf', raison: 'pasJumelee' };
  if ((j.voie === 'usb' && !v.usb) || (j.voie === 'serie' && !v.serie)) return { voie: 'pdf', raison: 'navigateur' };
  return { voie: 'directe', raison: '' };
}
// Pourquoi un envoi a échoué (le nom de l'erreur du navigateur ⇒ une raison dite en mots).
export const RAISONS_ECHEC = Object.freeze(['annule', 'pasTrouvee', 'occupee', 'refus', 'rendu', 'inconnue']);
export function raisonEchec(err) {
  const n = String((err && (err.raison || err.name)) || ''), m = String((err && err.message) || '');
  if (RAISONS_ECHEC.includes(n)) return n;
  if (n === 'NotFoundError' && /no device selected|aucun|cancel/i.test(m)) return 'annule';
  if (n === 'NotFoundError' || /disconnected|not found/i.test(m)) return 'pasTrouvee';
  if (n === 'SecurityError' || n === 'InvalidStateError' || /claim|busy|access denied|in use/i.test(m)) return 'occupee';
  if (n === 'NetworkError' || /stall|transfer/i.test(m)) return 'refus';
  return 'inconnue';
}
