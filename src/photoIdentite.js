// ══════════════════════════════════════════════════════════════════════════
// LA PHOTO D'ORIGINE EST UNE IDENTITÉ — ce que l'app LIT (24 nov., lot ext-anciens-lots,
// repris du lot photo-identite-sites du 16 nov., PR #1219).
//
// Julien (16 nov.) : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la
// reconnaît parce que la photo utilisée est exactement la même » — puis : « non pas à quoi elle
// ressemble, mais son CODE ». CLAUDE.md §5 : la photo est une IDENTITÉ quand c'est le même FICHIER.
//
// • L'identité vient du CODE EXACT (SHA-256) du fichier qu'il téléverse depuis son Chrome avec
//   l'extension (5.446) : la règle est `identitesParCode` (src/photoOrigine.js).
// • La ressemblance (« même photo · sûr », deux mesures) reste une PROPOSITION dans « Relier mes
//   annonces » : son toucher relie. Elle n'est PAS une identité ici (sa décision du 16 nov.).
// • Rien n'est ÉCRIT : l'identité est CALCULÉE à chaque lecture et superposée aux liens qu'il a
//   posés (`liensLbcAvecPhoto`) ; ses liens gagnent toujours, un lien qu'il a DÉFAIT (clé présente,
//   même vide) n'est jamais refait. Une lecture ratée ⇒ aucune identité par la photo.
// Module PUR (sauf l'état publié en bas) : l'app et scripts/audit-photo-identite.cjs l'exécutent.
// ══════════════════════════════════════════════════════════════════════════

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const arr = (a) => (Array.isArray(a) ? a : []);
const plein = (v) => v != null && String(v).trim() !== '';

// Ses liens d'abord, puis la photo d'origine là où il n'a rien décidé.
export function liensLbcAvecPhoto(manuels, ident) {
  const m = objet(manuels) || {};
  const p = ident && ident.lu ? objet(ident.Leboncoin) || {} : {};
  if (!Object.keys(p).length) return m;
  const out = { ...m };
  for (const [id, n] of Object.entries(p)) if (!Object.prototype.hasOwnProperty.call(m, id) && plein(n)) out[id] = n;
  return out;
}

// Les annonces des autres sites (forme de src/memePhoto.js) vues À TRAVERS l'identité : une annonce
// Leboncoin reconnue par la photo d'origine est « reliée » à son N° (preuve `photo-origine`) — « Relier
// mes annonces » la montre reliée, jamais « à relier ».
export function autresAvecIdentites(autres, ident) {
  const p = ident && ident.lu ? objet(ident.Leboncoin) || {} : {};
  if (!Object.keys(p).length) return arr(autres);
  return arr(autres).map((a) => {
    if (!a || a.plateforme !== 'Leboncoin' || a.relie || plein(a.numero)) return a;
    const n = p[String(a.id)];
    if (!plein(n)) return a;
    return { ...a, relie: true, numero: String(n), identites: [...arr(a.identites), { sorte: 'photo-origine', numero: String(n) }] };
  });
}

// Une signature stable des identités (pour ne prévenir les lecteurs que si elles CHANGENT).
export function signatureIdentites(ident) {
  if (!ident || !ident.lu) return 'pas-su';
  return arr(ident.liste).map((x) => `${x.plateforme}:${x.id}=${x.numero}`).sort().join('|');
}

// ── L'ÉTAT PUBLIÉ (un propriétaire : `chargerMemePhoto`, App.jsx) ─────────────────────────
let _ident = null;                                    // null = pas encore calculé ⇒ aucune identité par la photo
export const EVT_IDENTITES_PHOTO = 'vrm:identites-photo';
export function poserIdentitesPhoto(ident) {
  const avant = signatureIdentites(_ident);
  _ident = ident && ident.lu ? ident : null;
  const change = avant !== signatureIdentites(_ident);
  if (change) { try { window.dispatchEvent(new CustomEvent(EVT_IDENTITES_PHOTO, { detail: { n: _ident ? _ident.liste.length : 0 } })); } catch (_) { /* hors navigateur */ } }
  return change;
}
export const lireIdentitesPhoto = () => _ident;
