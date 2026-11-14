// ── LE CODE À 4 CHIFFRES À L'OUVERTURE (14 nov., lot 127) ──────────────────────
// Julien : « Code à 4 chiffres à l'ouverture de l'app, gardé sur ton téléphone uniquement. »
// ⚠️ CE N'EST PAS UNE SÉCURITÉ DU SERVEUR. Le code vit sur CET appareil seulement :
//    il empêche quelqu'un qui prend le téléphone déverrouillé d'ouvrir VRM d'un coup
//    d'œil. Il ne protège ni le compte (le mot de passe et la double vérification le
//    font), ni les données en cas de vol de l'appareil par quelqu'un qui sait
//    lire le stockage du navigateur. L'écran le DIT.
// Ce qui est rangé (`vrm_code_local`, localStorage de CET appareil, jamais synchronisé) :
//    { v: 1, sel (16 octets, base64), iter, empreinte (PBKDF2-SHA-256, base64), apresMin, erreurs }
//    JAMAIS le code en clair, ni rien qui le contienne tel quel.
// Verrou : à l'ouverture de l'app, et après `apresMin` minutes en arrière-plan
// (1, 5 ou 15 ; 5 par défaut). 5 erreurs de suite ⇒ déconnexion PROPRE (la session
// de cet appareil fermée, le code effacé) : on se reconnecte avec son mot de passe.
// `deriver` reçoit `subtle` (WebCrypto) en paramètre : l'audit l'exécute avec celui de Node.
export const CLE_CODE_LOCAL = 'vrm_code_local';
export const CODE_ERREURS_MAX = 5;
export const CODE_ITER = 150000;
export const CODE_APRES_MIN = [1, 5, 15];
export const CODE_APRES_DEFAUT = 5;
export const codeValide = (c) => /^\d{4}$/.test(String(c == null ? '' : c));
// 0000, 1234, 1111… : refusés (devinés en premier).
export const codeTropSimple = (c) => /^(\d)\1{3}$/.test(c) || ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'].includes(c);

const b64 = (u8) => { let t = ''; for (const x of u8) t += String.fromCharCode(x); return btoa(t); };
const deB64 = (s) => Uint8Array.from(atob(String(s)), (c) => c.charCodeAt(0));

export async function deriver(code, selB64, { subtle, iter = CODE_ITER } = {}) {
  const enc = new TextEncoder();
  const k = await subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64(selB64), iterations: iter }, k, 256);
  return b64(new Uint8Array(bits));
}

// Fabrique la ligne à ranger pour un code neuf. Rend null si le code n'est pas permis.
export async function fabriquerCode(code, { subtle, alea, apresMin = CODE_APRES_DEFAUT } = {}) {
  if (!codeValide(code) || codeTropSimple(String(code))) return null;
  const sel = new Uint8Array(16); alea(sel);
  const selB64 = b64(sel);
  return { v: 1, sel: selB64, iter: CODE_ITER, empreinte: await deriver(code, selB64, { subtle }), apresMin: CODE_APRES_MIN.includes(apresMin) ? apresMin : CODE_APRES_DEFAUT, erreurs: 0 };
}

export function lireCode(stockage) {
  try {
    const r = JSON.parse(stockage.getItem(CLE_CODE_LOCAL) || 'null');
    return r && r.v === 1 && typeof r.sel === 'string' && typeof r.empreinte === 'string' && Number.isFinite(r.iter) ? r : null;
  } catch (_) { return null; }
}
export function ecrireCode(stockage, r) { try { if (r) stockage.setItem(CLE_CODE_LOCAL, JSON.stringify(r)); else stockage.removeItem(CLE_CODE_LOCAL); return true; } catch (_) { return false; } }

// Comparaison à temps constant des deux empreintes (même longueur).
const egal = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// Essai d'un code. Rend { ok: true } · { ok: false, reste } · { ok: false, deconnecter: true }.
// Le compteur d'erreurs est rangé AVANT de répondre (fermer l'app ne le remet pas à zéro).
export async function essayerCode(code, stockage, { subtle } = {}) {
  const r = lireCode(stockage);
  if (!r) return { ok: true };
  const e = codeValide(code) ? await deriver(code, r.sel, { subtle, iter: r.iter }) : '';
  if (e && egal(e, r.empreinte)) { ecrireCode(stockage, { ...r, erreurs: 0 }); return { ok: true }; }
  const erreurs = (Number(r.erreurs) || 0) + 1;
  if (erreurs >= CODE_ERREURS_MAX) { ecrireCode(stockage, null); return { ok: false, deconnecter: true }; }
  ecrireCode(stockage, { ...r, erreurs });
  return { ok: false, reste: CODE_ERREURS_MAX - erreurs };
}

// Faut-il verrouiller ? À l'ouverture (`ouverture`), ou au retour après `apresMin` minutes cachée.
export function doitVerrouiller(r, { ouverture = false, cacheeDepuis = null, maintenant = Date.now() } = {}) {
  if (!r) return false;
  if (ouverture) return true;
  if (!Number.isFinite(cacheeDepuis)) return false;
  const min = CODE_APRES_MIN.includes(r.apresMin) ? r.apresMin : CODE_APRES_DEFAUT;
  return maintenant - cacheeDepuis >= min * 60000;
}
