// ── SÉANCE PHOTO — la feuille (14 nov., proposition 103) ───────────────────────────
// La liste des paires à prendre ou reprendre en photo (src/seancePhoto.js : sans photo
// dans VRM, moins de N, ou une photo signalée floue / sombre), dans l'ordre des N°,
// cochées au fur et à mesure (par identité : la clé du N°). Toucher une rangée ouvre le
// studio sur CETTE paire ; une photo rangée la coche. Chargée à la demande.
import React from 'react';
import { tr } from './i18n/index.js';
import { N_CHOIX, N_DEFAUT } from './seancePhoto.js';
import './styles-atelier-photos.css';

const RAISON = { aucune: 'atelier.seance.raison.aucune', peu: 'atelier.seance.raison.peu', douteuse: 'atelier.seance.raison.douteuse', faite: 'atelier.seance.raison.faite', passu: 'atelier.seance.raison.passu' };

export default function SeancePhoto({ Feuille, Bouton, Segmente, Icon, Photo, etat, lignes, onCommencer, onCocher, onPhotographier, onClose }) {
  // etat : undefined (lecture) · null (pas su) · 'pret'
  const [n, setN] = React.useState(N_DEFAUT);
  const [refaire, setRefaire] = React.useState(false);
  const enCours = lignes && !refaire;
  const tete = enCours ? (
    <div className="vrm-at-chiffre" data-seance-compte={`${lignes.faites}/${lignes.total}`}>
      <b>{lignes.faites}</b><span>{tr('atelier.seance.surTotal', { n: lignes.total })}</span>
    </div>
  ) : null;
  return (
    <Feuille onClose={onClose} titre={tr('atelier.seance.titre')} data-seance-photo={enCours ? 'en-cours' : 'depart'}>
      <div className="vrm-at-feuille">
        {tete}
        {!enCours ? (<>
          <p className="vrm-at-raison" style={{ margin: 0 }}>{tr('atelier.seance.explique')}</p>
          <div>
            <h3 className="vrm-at-titre" style={{ margin: '0 4px 8px' }}>{tr('atelier.seance.moinsDe')}</h3>
            <Segmente label={tr('atelier.seance.moinsDe')} value={n} onChange={setN} options={N_CHOIX.map((x) => ({ v: x, l: String(x), data: { 'data-seance-n': x } }))}/>
          </div>
          {etat === null ? <p className="vrm-at-refus" role="alert" data-seance-passu="">{tr('atelier.seance.passu')}</p> : null}
          <Bouton variante="primaire" plein data-seance-commencer="" disabled={etat === undefined} onClick={async () => { const ok = await onCommencer(n); if (ok) setRefaire(false); }}>{tr(etat === undefined ? 'atelier.photos.lecture' : 'atelier.seance.commencer')}</Bouton>
          {lignes && refaire ? <Bouton variante="discret" plein onClick={() => setRefaire(false)}>{tr('atelier.annuler')}</Bouton> : null}
        </>) : (<>
          {lignes.total ? (
            <ul className="vrm-at-liste" data-seance-lignes={lignes.total}>
              {lignes.lignes.map((l) => (
                <li key={l.cle} className={'vrm-at-ligne' + (l.coche ? ' is-cochee' : '')} data-seance-ligne={l.cle} data-seance-raison={l.raison} data-seance-coche={l.coche ? '1' : '0'}>
                  <button type="button" className="vrm-at-ligne-btn" data-seance-photographier={l.cle} onClick={() => onPhotographier(l)}>
                    <span className="vrm-at-vignette">{l.photo && Photo ? Photo(l.photo) : (Icon ? <Icon name="camera" size={20}/> : null)}</span>
                    <span className="vrm-at-ligne-txt">
                      <b>N°{l.num}</b>
                      {l.titre ? <span>{l.titre}</span> : null}
                      {l.coche ? null : <em>{tr(RAISON[l.raison] || RAISON.aucune, { n: l.nPhotos == null ? '—' : l.nPhotos, sur: lignes.n })}</em>}
                    </span>
                  </button>
                  <button type="button" role="checkbox" aria-checked={l.coche} aria-label={tr(l.coche ? 'atelier.seance.decocher' : 'atelier.seance.cocher', { num: l.num })} className="vrm-at-coche" data-seance-cocher={l.cle} onClick={() => onCocher(l.cle, !l.coche)}>
                    <span>{l.coche && Icon ? <Icon name="check" size={16}/> : null}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="vrm-at-vide" data-seance-vide="">{tr('atelier.seance.rien')}</p>}
          <Bouton variante="discret" plein data-seance-nouvelle="" onClick={() => setRefaire(true)}>{tr('atelier.seance.nouvelle')}</Bouton>
        </>)}
      </div>
    </Feuille>
  );
}
