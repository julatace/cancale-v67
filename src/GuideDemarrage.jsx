// ── LE GUIDE DE DÉMARRAGE ET LE BANDEAU DE L'EXEMPLE (6 nov.) ────────────────
// La RÈGLE (étapes, preuves, étape courante) est dans src/guideDemarrage.js ; le
// mode exemple dans src/modeExemple.js. Ici, seulement ce qui se dessine.
//   · `GuideDemarrage` : « Démarrer avec VRM · N sur 4 », une barre de progrès,
//     les quatre étapes (chacune dit pourquoi ; ✓ seulement sur une preuve lue),
//     le détail de l'étape courante (`detail` : pour l'extension et Vinted, la
//     carte `PremiersPas` de l'app, rendue SANS son cadre — une seule carte), et
//     « Découvrir avec des exemples » tant qu'aucun compte n'est relié.
//   · `BandeauExemple` : en mode exemple, sur TOUS les écrans, « Exemple — rien
//     n'est à toi » et « Brancher mes comptes » (qui sort de l'exemple).
import React from 'react';
import './guide-demarrage.css';

const ETAT_MOT = { fait: 'Fait', encours: 'Je vérifie…', passu: 'Pas pu vérifier', afaire: '' };

export function GuideDemarrage({ guide, nav = '', detail = null, gestes = {}, onExemple = null, onMasquer = null }) {
  if (!guide) return null;
  const { etapes, faites, total, courante } = guide;
  const pct = Math.round((faites / total) * 100);
  return (
    <section className="vrm-guide" data-guide-demarrage="" data-guide-faites={faites} data-guide-courante={courante || ''} aria-labelledby="vrm-guide-titre">
      <div className="vrm-guide-tete">
        <h2 id="vrm-guide-titre" className="vrm-guide-titre">Démarrer avec VRM</h2>
        <span className="vrm-guide-compte" data-guide-progres={`${faites}/${total}`}>{faites} sur {total}</span>
      </div>
      <div className="vrm-guide-barre" role="progressbar" aria-label="Étapes faites" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="vrm-guide-etapes">
        {etapes.map((e, i) => {
          const ici = e.cle === courante;
          const geste = gestes[e.cle];
          return (
            <li key={e.cle} className="vrm-guide-etape" data-guide-etape={e.cle} data-etat={e.etat} data-courante={ici ? '1' : '0'} aria-current={ici ? 'step' : undefined}>
              <span className="vrm-guide-marque" aria-hidden="true">{e.etat === 'fait' ? <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg> : i + 1}</span>
              <div className="vrm-guide-corps">
                <div className="vrm-guide-ligne">
                  <span className="vrm-guide-nom">{e.cle === 'extension' && nav ? `${e.titre} ${nav}` : e.titre}</span>
                  {ETAT_MOT[e.etat] ? <span className="vrm-guide-etat" data-guide-etat-mot={e.etat}>{ETAT_MOT[e.etat]}</span> : null}
                </div>
                {e.etat !== 'fait' && <p className="vrm-guide-pourquoi">{e.pourquoi}</p>}
                {ici && (e.cle === 'extension' || e.cle === 'vinted') && detail ? <div className="vrm-guide-detail" data-guide-detail={e.cle}>{detail}</div> : null}
                {ici && geste ? (
                  <div className="vrm-guide-geste">
                    <button type="button" className="vrm-b vrm-b-primaire" data-guide-geste={e.cle} onClick={geste.onClick}>{geste.libelle}</button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {(onExemple || onMasquer) && (
        <div className="vrm-guide-pied">
          {onExemple ? (
            <div className="vrm-guide-exemple">
              <p>Pas encore prêt&nbsp;? Regarde VRM rempli avec des données inventées. Rien n’est enregistré.</p>
              <button type="button" className="vrm-b vrm-b-secondaire" data-exemple-entrer="" onClick={onExemple}>Découvrir avec des exemples</button>
            </div>
          ) : null}
          {onMasquer ? <button type="button" className="vrm-b vrm-b-discret" data-guide-masquer="" onClick={onMasquer}>Masquer le guide</button> : null}
        </div>
      )}
    </section>
  );
}

export function BandeauExemple({ onBrancher, style }) {
  return (
    <div className="vrm-exemple-bandeau" role="region" aria-label="Mode exemple" data-exemple-bandeau="" style={style}>
      <div className="vrm-exemple-texte">
        <b>Exemple — rien n’est à toi</b>
        <span>Ces données sont inventées. Rien n’est enregistré, rien n’est envoyé.</span>
      </div>
      <button type="button" className="vrm-b vrm-b-primaire" data-exemple-brancher="" onClick={onBrancher}>Brancher mes comptes</button>
    </div>
  );
}
