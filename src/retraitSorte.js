// ════════════════════════════════════════════════════════════════════════════
//  CONSIGNE OU COMPTOIR ? (19 nov., retraits parfaits)
//  Julien : « il y a quatre colis, j'ai un seul code de retrait » (passe Mondial Relay « Intermarché »). Mesuré
//  sur sa base (lecture seule) : au même magasin, un COMPTOIR (« Intermarché Le Portail », on donne le code à
//  la caisse) et une CONSIGNE (« Locker 24/7 Intermarché », on TAPE le code sur l'écran du casier) — deux
//  endroits, deux gestes. La ligne doit le dire, et un casier n'est jamais rangé avec le comptoir du même nom.
//
//  UNE règle, pure (aucun appel) : `sorteRetrait` rend 'consigne' quand une source LE DIT —
//    · le nom ou le type du lieu (« Locker 24/7 … », « Consigne Vinted Go », « Casier … », « Pickup Station »,
//      « Parcel Locker », « Locker InPost ») ;
//    · le drapeau `consigne` posé par la route des e-mails sur CE colis (le texte de SON e-mail le dit) ;
//    · le libellé lu chez le transporteur pour CE n° de suivi (« prêt à être retiré en consigne », Vinted Go).
//  Sinon 'comptoir'. Jamais déduit d'un nom de magasin ni d'un autre colis.
// ════════════════════════════════════════════════════════════════════════════

export const NOM_CONSIGNE = /\b(?:locker|lockers|consigne|casier|casiers|pickup\s+station|parcel\s*locker|packstation|abri\s*colis)\b/i;
const LIBELLE_CONSIGNE = /\b(?:en|dans\s+la|a\s+la|à\s+la)\s+consigne\b|\blocker\b|\bcasier\b/i;

export function sorteRetrait({ lieu = '', nom = '', type = '', consigne = null, libelleTransp = '' } = {}) {
  for (const s of [type, nom, lieu]) if (s && NOM_CONSIGNE.test(String(s))) return 'consigne';
  if (consigne === true || consigne === 'true') return 'consigne';
  if (libelleTransp && LIBELLE_CONSIGNE.test(String(libelleTransp))) return 'consigne';
  return 'comptoir';
}

// Un point (src/relaisColis.js `regrouperRelais`) est une consigne quand chacun de ses colis l'est.
export const pointEstConsigne = (p) => !!p && Array.isArray(p.arrives) && p.arrives.length > 0 && p.arrives.every((x) => x && x.sorte === 'consigne');
