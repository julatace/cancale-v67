// ═══════════════════════════════════════════════════════════════════════════
// LE LIEN D'UN PARTENAIRE (15 nov.) — `https://vrm.center/p/LEO` (vercel.json →
// `/?partenaire=LEO`). Même chemin que le lien de parrainage : le code est GARDÉ
// sur l'appareil jusqu'à ce qu'un compte connecté le présente au serveur, UNE
// fois ; le serveur décide tout (api/_lib/partenaires.js `rattacherPartenaire`).
// Un refus définitif l'efface ; « pas su » (5xx, pas de session) le garde.
// (`?code=` est pris par le retour d'une connexion Google : jamais utilisé ici.)
// ═══════════════════════════════════════════════════════════════════════════
export const CLE_PARTENAIRE = 'vrm_partenaire_code';
export const CODE_PARTENAIRE_RE = /^[A-Z0-9]{3,16}$/;
export const canon = (c) => { const t = String(c == null ? '' : c).trim().toUpperCase(); return CODE_PARTENAIRE_RE.test(t) ? t : ''; };

export function codePartenaireDe(search) {
  try { return canon(new URLSearchParams(search || '').get('partenaire')); } catch (_) { return ''; }
}
// `/p/LEO` ouvert sans la redirection (copie d'adresse, aperçu local).
export function codePartenaireDuChemin(chemin) {
  const m = /^\/p\/([A-Za-z0-9]{3,16})\/?$/.exec(String(chemin || ''));
  return m ? canon(m[1]) : '';
}
export function codePartenaireGarde(stock) {
  try { return canon(stock && stock.getItem(CLE_PARTENAIRE)); } catch (_) { return ''; }
}
export function garderCodePartenaire(stock, search, chemin) {
  const c = codePartenaireDe(search) || codePartenaireDuChemin(chemin);
  if (c) { try { stock.setItem(CLE_PARTENAIRE, c); } catch (_) {} }
  return c;
}

// (16 nov., lot vitesse-lectures) Présenter le code au serveur : src/partenaires/presenter.js (l'app seule ;
// ce fichier-ci est lu dès le démarrage par la page d'accueil, il reste minuscule).
