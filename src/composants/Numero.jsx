// ═══════════════════════════════════════════════════════════════════════════
// LA PASTILLE N° — une seule forme (5 nov., revue de cohérence 2.9)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : la pastille du N° change de forme d'un écran à l'autre
// (pilule encre, texte gras nu, case grise, chiffres à chasse fixe ou non) et
// devient BLANCHE en mode sombre (`.vrm-num-pastille` : fond = encre, qui est
// claire en sombre) — un N° est écrit sur un carton réel (§5), il doit se lire
// d'un coup d'œil, partout pareil.
// La forme : rayon 6 (--r-num), chiffres alignés, graisse 700 ;
//   · clair : fond encre #1D1D1F, texte blanc ;
//   · sombre : fond gris élevé #48484A, texte #F5F5F7 — jamais blanche ;
//   · `etat="doublon"` : ROUGE — le SEUL rouge de l'app (deux articles présents
//     sous ce N°, §5/§7) ;
//   · `etat="aVerifier"` : ambre (« à vérifier sur son carton », un geste à faire).
// Un N° absent ne s'écrit pas (`null` : jamais « N° — » ni un numéro deviné).
// API : <Numero n taille?="petit|normal|grand" etat? prefixe? titre? className? {...data-*}>
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';

export function Numero({ n, taille = 'normal', etat, prefixe = true, titre, className = '', ...rest }) {
  if (n == null) return null;
  const txt = String(n).trim();
  if (!txt) return null;
  const e = etat === 'doublon' || etat === 'aVerifier' ? etat : null;
  const nomLu = titre || `Numéro ${txt}${e === 'doublon' ? ', porté par deux articles' : e === 'aVerifier' ? ', à vérifier sur le carton' : ''}`;
  return (
    <span className={`vrm-num vrm-num-${taille === 'petit' || taille === 'grand' ? taille : 'normal'}${className ? ' ' + className : ''}`}
      data-num={txt} data-num-etat={e || undefined} title={titre} aria-label={nomLu} {...rest}>
      {prefixe ? <span className="vrm-num-prefixe" aria-hidden="true">N°</span> : null}<span aria-hidden="true">{txt}</span>
    </span>
  );
}

export default Numero;
