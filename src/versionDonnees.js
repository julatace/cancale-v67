// ════════════════════════════════════════════════════════════════════════════
//  LA VERSION DES DONNÉES QU'UN CALCUL LIT HORS DE REACT (18 nov., moteur-rapide)
//
//  Un calcul de rendu mémorisé (ex. `commandesAVerifier`, Ma journée) ne se refait que si
//  une de ses entrées a changé. Ses entrées React (états, props) se comparent par identité ;
//  ce qu'il lit HORS de React n'a pas d'identité qui change :
//   · le stockage de l'appareil (`load`, `localStorage`) : `suivreStockage(f)` exécute le
//     calcul en NOTANT chaque clé qu'il lit (`getItem`) ; `stockageInchange(lu)` dit si
//     aucune de ces clés n'a été écrite depuis (setItem, removeItem de cette page ; `clear` ;
//     une écriture d'un autre onglet, évènement `storage`). Une clé lue la fois d'après
//     mais pas celle d'avant ne peut pas exister sans qu'une clé lue ait changé (le calcul
//     est le même) : la liste notée suffit ;
//   · les tables gardées en mémoire de module et remplies en place (états des transactions,
//     copies Vestiaire…) : `versionMemoire()` monte quand leur propriétaire appelle
//     `toucherMemoire()` après les avoir changées.
//  Rien n'est lu ni écrit ici. Une version qui monte « pour rien » ne coûte qu'un calcul
//  refait (jamais un chiffre périmé).
// ════════════════════════════════════════════════════════════════════════════
let epoque = 0;                 // `clear()` ou écriture d'un autre onglet sans clé : tout est neuf
const versions = new Map();     // clé → nombre d'écritures de cette clé
let memoire = 0;
let notees = null;              // les clés lues par le calcul en cours (`suivreStockage`)
const ecrite = (k) => { versions.set(String(k), (versions.get(String(k)) || 0) + 1); };

export const versionMemoire = () => memoire;
export const toucherMemoire = () => { memoire += 1; };
export const versionCle = (k) => versions.get(String(k)) || 0;

// Exécute `f` en notant les clés du stockage qu'il lit. Rend { r, lu } ; `lu` sert à `stockageInchange`.
export function suivreStockage(f) {
  const avant = notees;
  const ici = new Set();
  notees = ici;
  let r;
  try { r = f(); } finally { notees = avant; if (avant) for (const k of ici) avant.add(k); }
  const lu = { epoque, cles: [...ici].map((k) => [k, versionCle(k)]) };
  return { r, lu };
}
export function stockageInchange(lu) {
  if (!lu || lu.epoque !== epoque) return false;
  for (const [k, v] of lu.cles) if (versionCle(k) !== v) return false;
  return true;
}

if (typeof window !== 'undefined') {
  try {
    const S = window.Storage && window.Storage.prototype;
    if (S && !S.__vrmVersion) {
      const local = function () { try { return this === window.localStorage; } catch (_) { return true; } };
      const lire = S.getItem, poser = S.setItem, retirer = S.removeItem, vider = S.clear;
      S.getItem = function (k) { if (notees && local.call(this)) notees.add(String(k)); return lire.call(this, k); };
      // Compté AVANT l'écriture : même une écriture refusée (quota) refait le calcul.
      S.setItem = function (k, v) { if (local.call(this)) ecrite(k); return poser.call(this, k, v); };
      S.removeItem = function (k) { if (local.call(this)) ecrite(k); return retirer.call(this, k); };
      S.clear = function () { if (local.call(this)) epoque += 1; return vider.call(this); };
      Object.defineProperty(S, '__vrmVersion', { value: true });
    }
  } catch (_) { /* pas de stockage : rien à suivre */ }
  try { window.addEventListener('storage', (e) => { if (e && e.key != null) ecrite(e.key); else epoque += 1; }); } catch (_) { /* rien */ }
}
