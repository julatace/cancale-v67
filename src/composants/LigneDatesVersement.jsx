// ══ « DATES DE VERSEMENT : L'EXTENSION LES RÉCUPÈRE » (15 nov., extension 5.390) ══════
// Julien : « Enlève les 1741 ventes à dater, cela n'a aucun sens. Le but est que
// l'extension récupère ces infos, pas que ça soit à nous de le faire. »
// UNE ligne, discrète, sans bouton ni lien (rien ne lui est demandé) ; rien quand tout est
// daté. La règle et le nombre viennent de la publication de Ventes (`aDater`, §11) par
// `ligneDatesVersement` (src/versementRaisons.js) — jamais un second calcul.
import React from 'react';
import { tr } from '../i18n/index.js';
import { ligneDatesVersement } from '../versementRaisons.js';

// `avecDelai` : le délai (« environ X h ») ne se promet qu'à une extension qui lit à ce rythme
// (`extSait('versementsauto') === 'ok'`, 5.390) ; sinon la ligne sans délai (« pas su » ≠ « oui »).
export function LigneDatesVersement({ ad, className = '', style, as: Balise = 'p', avecDelai = true }) {
  const L0 = ligneDatesVersement(ad);
  if (!L0) return null;
  const L = avecDelai ? L0 : { ...L0, heures: 0 };
  return (
    <Balise className={('vrm-dates-versement ' + className).trim()} role="note"
      data-dates-versement-ligne={L.n} data-dates-versement-heures={L.heures || 0}
      style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--vrm-muted, inherit)', ...(style || {}) }}>
      {tr(L.heures ? 'versement.ligne' : 'versement.ligneSans', { n: L.n, h: L.heures })}
    </Balise>
  );
}
export default LigneDatesVersement;
