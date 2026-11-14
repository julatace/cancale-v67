// ── (14 nov., passe design) UN TITRE NE SE COUPE JAMAIS AU TRAIT D'UNION D'UN MODÈLE ─────────
// « N°10 New Balance xt- / 6 taille 40 » : le navigateur coupe une ligne APRÈS un trait d'union
// (une coupure permise, que `hyphens: none` n'empêche pas). Un nom de modèle (« xt-6 », « gel-1130 »,
// « P-6000 ») se lit d'un bloc : chaque mot qui porte un trait d'union (20 signes au plus) est posé
// dans une portée insécable. Le TEXTE ne change pas (innerText, `title`, recherche : identiques) —
// seule la coupure de ligne change. Un mot plus long que la ligne reste coupable (rien ne déborde).
import React from 'react';

export function motsInsecables(texte) {
  const t = texte == null ? '' : String(texte);
  if (!/\S-\S/.test(t)) return t;
  // La clé d'une portée = sa POSITION dans le titre (le texte ne change pas pendant le rendu).
  const morceaux = []; let pos = 0;
  for (const m of t.split(/(\S+)/)) {
    morceaux.push(/^\S{3,20}$/.test(m) && /\S-\S/.test(m)
      ? <span key={'p' + pos} className="vrm-insecable" style={{ whiteSpace: 'nowrap' }}>{m}</span>
      : m);
    pos += m.length;
  }
  return morceaux;
}
