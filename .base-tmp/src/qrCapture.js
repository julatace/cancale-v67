// ── LE QR MONDIAL RELAY APPORTÉ PAR UNE CAPTURE DE L'APP (5 nov.) ────────────
// Julien (5 nov., mot pour mot) : « je ne peux pas avoir les qr code dans le
// navigateur c'est que dans l'app ». Le QR Mondial Relay n'existe QUE dans
// l'application mobile Mondial Relay : ni dans l'e-mail (0 sur 57 colis mesurés
// en base), ni sur mondialrelay.fr. Aucune extension ne peut donc le lire.
//
// Le seul chemin : SA capture d'écran de l'app, choisie par lui SUR un colis
// (« Ajouter le QR »). Le QR est décodé DANS la page (src/lireQrCapture.js :
// `BarcodeDetector` du navigateur, sinon jsQR embarqué — aucune IA, aucune image
// envoyée nulle part) ; ce module JUGE le contenu lu et le recopie.
//
// L'IDENTITÉ (§5) : le colis est celui où il a touché le bouton (SON clic). Le
// contenu n'est jamais rapproché par ressemblance ; il sert seulement à REFUSER :
//   · aucun QR lisible ⇒ rien n'est posé ;
//   · plusieurs QR différents sur la capture ⇒ rien (on ne choisit pas) ;
//   · le contenu porte le n° de suivi ou le code de retrait d'un AUTRE colis ⇒ rien ;
//   · le même QR déjà posé sur un autre colis ⇒ rien (un QR, un colis).
//
// ⚠️ JAMAIS UN QR FABRIQUÉ À PARTIR DU CODE OU DU N° (un QR inventé refusé au
// relais = colis pas retiré). Ce qui est dessiné est le CONTENU LU sur sa capture,
// recopié à l'identique — et prouvé : l'image dessinée est relue par jsQR et doit
// rendre EXACTEMENT le contenu lu (aller-retour), sinon rien n'est posé.
// Pur : les bibliothèques (qrcode-generator, jsQR) sont passées par l'appelant.

export const CLE_QR_POSES = 'vrm_colis_qr_poses';
// Le n° de suivi, forme de la clé (la même que `normaliserSuivi`, api/_lib/etat-colis-email.js).
export const cleSuiviQr = (v) => String(v || '').toUpperCase().replace(/[\s -]+/g, '').trim();
// Une identité comparable : lettres et chiffres seulement.
const alnum = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Recopiable à l'identique : texte ASCII imprimable, de 1 à 400 caractères. Au-delà
// (octets binaires, accents d'un autre encodage), une recopie pourrait différer de
// l'original sans qu'on le voie : on refuse plutôt que de risquer un faux.
export const contenuRecopiable = (s) => typeof s === 'string' && s.length > 0 && s.length <= 400 && /^[\x20-\x7E]+$/.test(s);

// Les identités qu'un contenu PORTE : ses jetons alphanumériques entiers, et — pour un
// long code-barres de 26 chiffres — le n° d'expédition aux chiffres 3 à 10 (la forme
// mesurée pour « Scanner », src/scanColis.js). Jamais une sous-chaîne quelconque.
export function identitesDuContenu(contenu) {
  const ids = new Set();
  for (const brut of String(contenu || '').toUpperCase().split(/[^A-Z0-9]+/)) {
    if (!brut) continue;
    ids.add(brut);
    if (/^\d{26}$/.test(brut)) ids.add(brut.slice(2, 10));
  }
  return ids;
}
// Les identités d'un colis : son n° de suivi, son code de retrait, son second code.
export function identitesDuColis(c) {
  if (!c) return [];
  return [c.suivi, c.code, c.code2].map(alnum).filter((x) => x.length >= 3);
}

// Le jugement d'une capture lue. `contenus` : ce que le lecteur a trouvé (null = la
// capture n'a pas pu être ouverte, [] = aucun QR). `colis` : celui de SON clic
// ({ suivi, code, code2 }). `autres` : tous les autres colis connus. `poses` : les QR
// déjà posés (clé = n° de suivi). Rend { etat, … } ; seul `etat: 'pose'` pose.
export function jugerQrCapture({ contenus, colis, autres = [], poses = {} } = {}) {
  const cle = cleSuiviQr(colis && colis.suivi);
  if (!cle) return { etat: 'sans-suivi' };
  if (contenus == null) return { etat: 'illisible' };
  const uniques = [...new Set((Array.isArray(contenus) ? contenus : []).filter((s) => typeof s === 'string' && s.length))];
  if (!uniques.length) return { etat: 'aucun' };
  if (uniques.length > 1) return { etat: 'plusieurs', n: uniques.length };
  const contenu = uniques[0];
  const ids = identitesDuContenu(contenu);
  const miennes = new Set(identitesDuColis(colis));
  for (const a of (Array.isArray(autres) ? autres : [])) {
    if (!a || cleSuiviQr(a.suivi) === cle) continue;
    for (const id of identitesDuColis(a)) {
      if (!miennes.has(id) && ids.has(id)) return { etat: 'autre', suivi: cleSuiviQr(a.suivi) || '', id };
    }
  }
  for (const [k, p] of Object.entries(poses && typeof poses === 'object' ? poses : {})) {
    if (k !== cle && p && p.contenu === contenu) return { etat: 'deja', suivi: k };
  }
  if (!contenuRecopiable(contenu)) return { etat: 'recopie' };
  return { etat: 'pose', contenu, porte: [...miennes].some((id) => ids.has(id)) };
}

// La recopie : le CONTENU LU dessiné en QR, puis relu (aller-retour). `libs` =
// { qrcode, jsQR }. Rend { type, b64, modules } ou null (rien n'est posé).
export function dessinerQrCapture(contenu, { qrcode, jsQR } = {}) {
  if (!contenuRecopiable(contenu) || typeof qrcode !== 'function' || typeof jsQR !== 'function') return null;
  let qr;
  try { qr = qrcode(0, 'M'); qr.addData(contenu, 'Byte'); qr.make(); } catch (_) { return null; }
  const n = qr.getModuleCount();
  const cell = 4, marge = 4, w = (n + 2 * marge) * cell;
  const px = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = (((r + marge) * cell + y) * w + (c + marge) * cell + x) * 4;
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;
    }
  }
  let relu = null;
  try { relu = jsQR(px, w, w, { inversionAttempts: 'dontInvert' }); } catch (_) { relu = null; }
  if (!relu || relu.data !== contenu) return null;
  const url = qr.createDataURL(8, 4);
  const m = /^data:image\/gif;base64,([A-Za-z0-9+/]+=*)$/.exec(String(url || ''));
  return m ? { type: 'image/gif', b64: m[1], modules: n } : null;
}

// Un QR posé, tel que rangé : vérifié à la lecture (une forme inconnue n'entre pas).
export function poseValide(p) {
  if (!p || typeof p !== 'object' || !contenuRecopiable(p.contenu)) return null;
  if (p.type !== 'image/gif' || typeof p.b64 !== 'string' || p.b64.length > 20000 || !/^[A-Za-z0-9+/]+=*$/.test(p.b64)) return null;
  return p;
}

// Les lignes de suivi des colis à retirer, avec le QR qu'il a posé (clé = n° de suivi).
// Seulement sur une ligne SANS QR à elle, et seulement si le code de la ligne est celui
// d'au moment de la pose (un code nouveau ⇒ ce QR va avec l'ancien : pas montré, comme
// `fusionLignesMemeSuivi`). `null` (e-mails pas lus) reste null.
export function avecQrPoses(lignes, poses, { suiviDe = (t) => cleSuiviQr(t && t.suivi), aDejaQr = (t) => !!(t && (t.qrB64 || t.qrUrl)), codeDe = (t) => alnum(t && t.code) } = {}) {
  if (!Array.isArray(lignes) || !poses || typeof poses !== 'object' || !Object.keys(poses).length) return lignes;
  return lignes.map((t) => {
    if (!t || aDejaQr(t)) return t;
    const k = suiviDe(t); const p = k ? poseValide(poses[k]) : null;
    if (!p) return t;
    const cLigne = codeDe(t), cPose = alnum(p.code);
    if (cLigne && cPose && cLigne !== cPose) return t;
    return { ...t, qrB64: p.b64, qrType: p.type, qrUrl: null, qrSource: 'capture', qrPoseAt: p.at || null };
  });
}

// La phrase d'un QR qu'on n'a pas (le titre court). Mondial Relay : la vérité —
// il est dans l'app, et le code suffit au comptoir.
export const titreQrAbsent = (carrier) => (String(carrier || '').toLowerCase() === 'mondialrelay' ? 'QR dans l’app Mondial Relay' : 'QR pas reçu');
// On ne propose la capture que pour Mondial Relay (le seul dont le QR vit dans une app).
export const qrParCapture = (carrier) => String(carrier || '').toLowerCase() === 'mondialrelay';

// Ce que l'écran dit après une tentative (une phrase, jamais une promesse).
export function messageQrCapture(j) {
  if (!j) return '';
  switch (j.etat) {
    case 'pose': return j.porte ? 'QR ajouté · il porte le n° de ce colis' : 'QR ajouté';
    case 'aucun': return 'Aucun QR lisible sur cette capture : rien n’est posé.';
    case 'plusieurs': return 'Plusieurs QR sur cette capture : recadre-la sur celui du colis. Rien n’est posé.';
    case 'autre': return `Ce QR porte ${j.suivi ? `l’identité du colis n° ${j.suivi}` : 'l’identité d’un autre colis'} : rien n’est posé ici.`;
    case 'deja': return `Ce QR est déjà posé sur le colis n° ${j.suivi} : rien n’est posé ici.`;
    case 'recopie': return 'Ce QR ne peut pas être recopié à l’identique : rien n’est posé. Montre-le depuis l’app Mondial Relay.';
    case 'illisible': return 'La capture n’a pas pu être ouverte : rien n’est posé.';
    case 'sans-suivi': return 'Ce colis n’a pas de n° de suivi : rien ne peut y être posé.';
    case 'lecture': return 'Lecture de la capture…';
    default: return '';
  }
}
