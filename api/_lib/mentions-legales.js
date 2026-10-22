// ── LES MENTIONS DE L'ÉDITEUR, LUES PAR LE SERVEUR (22 octobre) ──────────────
// UNE source : public/legal/editeur.js (les pages légales l'affichent ; ici on
// la lit pour décider si le paiement peut s'ouvrir). Mesuré le 22 octobre en
// production : les 10 champs valent `null`, src/contact.js est vide, et les CGV
// renvoient à « écrire à » une adresse qui n'existe pas. Vendre un abonnement
// sur ces CGV-là, c'est une information précontractuelle incomplète : un
// consommateur peut alors se rétracter jusqu'à 12 mois (art. L221-20 C. conso).
// ⇒ api/compte.js (mode checkout) refuse d'ouvrir le paiement tant qu'un champ
//    obligatoire est vide — même forme que le refus « prix ≠ CGV ».
//
// Trois états, jamais deux :
//   · `null`  = pas su (fichier illisible) ⇒ le paiement reste FERMÉ ;
//   · `[]`    = rien ne manque ;
//   · `[…]`   = les champs vides, avec leur libellé (pour le propriétaire seul).
// ⚠️ Rien n'est inventé : on ne fait que constater qu'un champ est vide.
export async function lireMentions() {
  try {
    // Import DYNAMIQUE, dans un try : un fichier mal édité ne doit faire tomber
    // que l'ouverture du paiement (le sens sûr), jamais toute la route.
    await import('../../public/legal/editeur.js');
  } catch (e) {
    console.warn('[mentions] public/legal/editeur.js illisible —', String(e && e.message || e).slice(0, 160));
    return null;
  }
  const E = globalThis.VRM_EDITEUR, O = globalThis.VRM_EDITEUR_OBLIGATOIRES, L = globalThis.VRM_EDITEUR_LIBELLES;
  if (!E || typeof E !== 'object' || !Array.isArray(O) || !O.length) return null;
  return { editeur: E, obligatoires: O.map(String), libelles: (L && typeof L === 'object') ? L : {} };
}

export function mentionsManquantes(m) {
  if (!m || !m.editeur || !Array.isArray(m.obligatoires)) return null;
  return m.obligatoires
    .filter((k) => !(typeof m.editeur[k] === 'string' && m.editeur[k].trim()))
    .map((k) => ({ cle: k, libelle: String((m.libelles && m.libelles[k]) || k) }));
}
