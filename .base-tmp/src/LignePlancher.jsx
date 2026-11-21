import React from 'react';
import { textePlancher } from './plancherOffre.js';

// La ligne discrète sous une offre (9 nov., lot F) : « En dessous de 62 € tu perds
// de l'argent ». Ambre seulement quand l'offre est sous le plancher (un geste à
// réfléchir, jamais rouge, §7). Sans prix d'achat : la porte pour le saisir
// (`onSaisir`), sinon rien. Les phrases viennent de `textePlancher` (même source
// que le chiffre).
export function LignePlancher({ plancher, offre = null, mini = null, ambre, onSaisir = null }) {
  const t = textePlancher(plancher, { offre, mini });
  if (!t) return null;
  if (t.niveau === 'achat') {
    if (!onSaisir) return null;
    return <p className="vrm-offre-repere" data-plancher="achat">
      Prix d’achat pas saisi : le plancher n’est pas calculé.{' '}
      <button type="button" className="vrm-pied-lien" data-plancher-saisir="" onClick={onSaisir}>Saisir le prix d’achat</button>
    </p>;
  }
  const sous = t.niveau === 'sous';
  return <p className="vrm-offre-repere" data-plancher={sous ? 'sous' : 'au-dessus'} data-plancher-cents={String(t.plancher)} data-plancher-partiel={t.partiel ? '1' : undefined}
    style={sous && ambre ? { color: ambre } : undefined}>
    {t.ligne}{t.precision ? <> ({t.precision})</> : null}.
    {t.offre ? <> <b data-plancher-perte="">{t.offre}</b></> : null}
    {t.mini ? <> <span data-plancher-mini="">{t.mini}</span></> : null}
  </p>;
}
