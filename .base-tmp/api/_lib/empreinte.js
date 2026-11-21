// ═══════════════════════════════════════════════════════════════════════════
// UNE EMPREINTE QUI NE SE CHEVAUCHE PAS (11 nov., familles-serveur, H8)
// ═══════════════════════════════════════════════════════════════════════════
// `shortHash` (31 bits, le hachage de chaîne de Java) servait d'IDENTIFIANT DE
// LIGNE pour les e-mails : par l'effet anniversaire, une collision devient
// probable dès quelques dizaines de milliers d'e-mails, et elle REMPLACE en
// silence l'e-mail d'un autre (une vente, un achat).
// `empreinte(texte)` : SHA-256 tronqué à 16 caractères hexadécimaux (64 bits).
// `ancienneEmpreinte(texte)` : l'ancien calcul, gardé À L'IDENTIQUE pour RELIRE
// les lignes déjà rangées sous l'ancienne clé (jamais pour en créer une neuve) :
// une ligne d'avant garde sa clé, un rejeu ne la double pas.
// Tenu par scripts/audit-familles-serveur.cjs (famille 5).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';

export const LONGUEUR_EMPREINTE = 16;

export function empreinte(texte) {
  return crypto.createHash('sha256').update(String(texte == null ? '' : texte)).digest('hex').slice(0, LONGUEUR_EMPREINTE);
}

export function ancienneEmpreinte(s) {
  let h = 0; const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

// Choisir la clé d'une ligne : l'ANCIENNE si une ligne d'avant existe déjà sous
// elle ET désigne la même chose (`memeChose(ligneLue)`), sinon la NOUVELLE.
// `lire(id)` rend la ligne projetée, `null` (absente) ou `undefined` (pas su).
// Rend l'id, ou `undefined` si la lecture a échoué (rien n'est écrit).
export async function cleCompatible({ prefixe, ancienne, nouvelle, lire, memeChose }) {
  const idAncien = prefixe + ancienne;
  const lu = await lire(idAncien);
  if (lu === undefined) return undefined;
  if (lu && memeChose(lu)) return idAncien;
  return prefixe + nouvelle;
}
