// ── L'ANNEAU DE L'OBJECTIF DU MOIS (15 nov., lot securite-ventes — proposition 14 « Jeu et progression »)
// Sur Ma journée, l'objectif du mois n'est plus une barre fine : un ANNEAU qui se remplit, et UNE ligne
// « encore 760 € · ≈ 35 € par jour jusqu’au 30 nov. ». Rien n'est calculé ici : la progression vient de
// `progressionObjectif` (la valeur = la case « Vendu · mois », règle VENDU `ventesFaites`, comptes
// sélectionnés), le reste et le rythme de `resteObjectif` (src/objectifMois.js). Trois états (§5) :
//   · pas su ⇒ l'anneau vide, « — » au centre, la raison en une ligne (jamais 0 %) ;
//   · « au moins » (un site pas lu, des prix d'achat manquants) ⇒ « ≥ 62 % », le reste est « au plus » ;
//   · atteint ⇒ l'anneau plein, « Objectif atteint », sans fête.
// Le montant VENDU n'est pas réécrit (il est déjà dans la case du mois : §7, un nombre une fois par écran) :
// l'anneau dit la PART, la cible et ce qui reste. Toucher l'anneau ⇒ le réglage de l'objectif (son clic).
// Les mêmes attributs `data-objectif-*` que la barre (audits, bancs, instantané).
import React from 'react';
import { tr } from '../i18n/index.js';
import { estEuros, resteObjectif, rythmeObjectif } from '../objectifMois.js';
import { motsAnneau } from '../anneauObjectif.js';
import './anneau-objectif.css';

const R = 30, TOUR = 2 * Math.PI * R;

export default function AnneauObjectif({ prog, onOuvrir = null, maintenant = null, prefixe = 'data-objectif' }) {
  if (!prog) return null;
  const quand = maintenant || Date.now();
  const m = motsAnneau(prog, quand);
  const eur = estEuros(prog.type);
  const r = resteObjectif(prog, quand);
  const ry = rythmeObjectif(prog, quand);
  const P = prefixe;
  const plein = m.pct == null ? 0 : Math.max(0, Math.min(100, m.pct));
  const attrs = {
    className: 'vrm-anneau-obj' + (onOuvrir ? ' is-touchable' : '') + ' is-' + m.etat,
    [P]: prog.type, [P + '-anneau']: '', [P + '-cible']: eur ? String(Math.round(prog.objectif * 100)) : String(prog.objectif),
    [P + '-valeur']: prog.valeur == null ? '' : (eur ? String(Math.round(prog.valeur * 100)) : String(prog.valeur)),
    [P + '-pct']: prog.pct == null ? '' : String(prog.pct), [P + '-partiel']: prog.partiel ? '1' : undefined, [P + '-atteint']: prog.atteint ? '1' : undefined,
    [P + '-reste']: r && !r.atteint ? (eur ? String(Math.round(r.reste * 100)) : String(r.reste)) : undefined,
    [P + '-par-jour']: r && !r.atteint && r.parJour != null ? (eur ? String(Math.round(r.parJour * 100)) : String(r.parJour)) : undefined,
    [P + '-jours']: r && !r.atteint ? String(r.jours) : undefined,
    [P + '-rythme']: ry ? ry.etat : undefined, [P + '-ecart']: ry && ry.etat !== 'dans' ? (eur ? String(Math.round(ry.ecart * 100)) : String(ry.ecart)) : undefined,
  };
  const corps = (
    <>
      <span className="vrm-anneau-obj-rond" role="progressbar" aria-label={m.titre} aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct == null ? undefined : prog.pct}>
        <svg viewBox="0 0 72 72" width="64" height="64" aria-hidden="true">
          <circle className="vrm-anneau-obj-piste" cx="36" cy="36" r={R} fill="none" strokeWidth="7"/>
          {plein > 0 ? <circle className="vrm-anneau-obj-fait" cx="36" cy="36" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(TOUR * plein) / 100} ${TOUR}`} transform="rotate(-90 36 36)"/> : null}
        </svg>
        <b className="vrm-anneau-obj-centre" {...{ [P + '-centre']: '' }}>{m.centre}</b>
      </span>
      <span className="vrm-anneau-obj-txt">
        <span className="vrm-anneau-obj-titre" {...{ [P + '-tete']: '' }}>{m.titre}</span>
        <span className="vrm-anneau-obj-ligne" {...{ [P + '-phrase']: '' }}>{m.ligne}</span>
      </span>
    </>
  );
  return onOuvrir
    ? <button type="button" {...attrs} data-objectif-ouvrir="" aria-label={tr('ann.aria', { titre: m.titre, centre: m.centre, ligne: m.ligne })} onClick={onOuvrir}>{corps}</button>
    : <div {...attrs}>{corps}</div>;
}
