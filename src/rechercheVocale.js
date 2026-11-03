// ═══════════════════════════════════════════════════════════════════════════
// LA RECHERCHE PAR LA VOIX (3 novembre) — ce que le navigateur a reconnu → la
// requête de la barre de recherche.
// ═══════════════════════════════════════════════════════════════════════════
// La reconnaissance est celle du NAVIGATEUR (Web Speech API, `fr-FR`), gratuite,
// sans clé ni serveur à nous (§2.9) : le bouton (`MicDictee`) n'apparaît que si
// l'API existe. Ce module PUR ne fait que lire le texte reconnu :
//   « numéro 124 », « N 124 », « n° 124 », « le 124 », « cent vingt-quatre »
//     ⇒ « 124 » (la recherche par numéro, `lireNumeroCherche`, prend le relais) ;
//   « B 125 », « b cent vingt-cinq », « bé 125 » ⇒ « B125 » (l'archive, §5) ;
//   tout le reste ⇒ le texte tel quel (sans la ponctuation de fin), qui cherche
//   un modèle ou une marque.
// On ne DEVINE rien : un mot qui n'est pas un nombre laisse le texte libre.
// Exécuté par scripts/audit-recherche-vocale.cjs.

const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const UNITES = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90 };

// Des mots → un nombre entier, ou null si un mot n'en est pas un.
export const nombreEnMots = (mots) => {
  if (!Array.isArray(mots) || !mots.length) return null;
  let total = 0, courant = 0, vu = false;
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i];
    if (m === 'et') { if (!vu) return null; continue; }
    if ((m === 'vingt' || m === 'vingts') && i > 0 && mots[i - 1] === 'quatre') { courant += 80 - 4; vu = true; continue; }
    if (m in UNITES) { courant += UNITES[m]; vu = true; continue; }
    if (m === 'cent' || m === 'cents') { courant = (courant || 1) * 100; vu = true; continue; }
    if (m === 'mille') { total += (courant || 1) * 1000; courant = 0; vu = true; continue; }
    return null;
  }
  return vu ? total + courant : null;
};

// Le texte reconnu → { requete, numero } (`numero` : la requête est un N°).
export const requeteDeLaVoix = (texte) => {
  const brut = String(texte == null ? '' : texte).trim().replace(/[.!?…,;:]+$/u, '').trim();
  if (!brut) return { requete: '', numero: false };
  let t = sansAccents(brut).toLowerCase().replace(/[°º#]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  // Les mots d'appel : « numéro », « num », « n », « no », « le », « la », « paire », « article ».
  const APPEL = /^(?:le|la|l'|numero|num|n|no|nr|paire|article|carton)\s+/;
  let avant;
  do { avant = t; t = t.replace(APPEL, ''); } while (t !== avant);
  // « n124 » collé (le N° dit d'un souffle).
  t = t.replace(/^n(?=\d)/, '');
  // Une lettre de série devant : « b 125 », « b125 », « bé 125 ».
  let lettre = '';
  const mL = /^(?:([a-z])\s*(?=\d)|([a-z]|be)\s+(?=\S))/.exec(t);
  if (mL) {
    const l = mL[1] || (mL[2] === 'be' ? 'b' : mL[2]);
    const reste = t.slice(mL[0].length).trim();
    if (lireNombre(reste) != null) { lettre = l.toUpperCase(); t = reste; }
  }
  const n = lireNombre(t);
  if (n == null) return { requete: brut, numero: false };
  return { requete: lettre + String(n), numero: true };
};

// « 124 », « 1 24 » (chiffres séparés par la dictée), ou des mots.
function lireNombre(t) {
  const s = String(t || '').trim();
  if (!s) return null;
  if (/^\d+(?: \d+)*$/.test(s)) { const n = parseInt(s.replace(/ /g, ''), 10); return Number.isFinite(n) && n < 100000 ? n : null; }
  return nombreEnMots(s.split(' '));
}
