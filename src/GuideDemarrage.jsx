// ── LE PARCOURS DES PREMIÈRES MINUTES ET LE BANDEAU DE L'EXEMPLE (6 nov., 8 nov.) ─
// La RÈGLE (étapes, preuves, étape courante, « Plus tard », numérotation,
// vérification) est dans src/guideDemarrage.js ; le mode exemple dans
// src/modeExemple.js. Ici, seulement ce qui se dessine — aucune lecture.
//   · `GuideDemarrage` : « Démarrer avec VRM · N sur 5 », une barre en segments,
//     la question de la numérotation (au départ seulement), les cinq étapes en
//     rangées (✓ seulement sur une preuve lue), l'étape courante ouverte — un
//     dessin, pourquoi, son geste, « Plus tard » —, puis « Voir VRM avec des
//     exemples », « Vérifier mon installation » et « Masquer le guide ».
//   · `VerificationInstallation` : une rangée par contrôle, l'état en un mot, LE geste.
//   · `BandeauExemple` : en mode exemple, sur TOUS les écrans, « Exemple — rien
//     n'est à toi » et « Passer à mes vraies données » (qui sort de l'exemple).
// Mouvement : un fondu court à l'ouverture d'une étape ; rien sous `prefers-reduced-motion`.
import React from 'react';
import './guide-demarrage.css';

const ETAT_MOT = { fait: 'Fait', encours: 'Je vérifie…', passu: 'Pas pu vérifier', afaire: '' };

const Coche = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>;

// Les dessins des étapes sans détail propre (le détail de l'extension et de Vinted
// porte déjà son dessin pas à pas). Traits à l'encre grise, l'accent pour l'objet.
export function IllustrationEtape({ cle }) {
  if (cle === 'emails') return (
    <svg className="vrm-guide-dessin" data-guide-dessin="emails" viewBox="0 0 240 84" aria-hidden="true">
      <rect x="16" y="20" width="76" height="50" rx="10" className="g-case" />
      <path d="M24 30l32 22 32-22" className="g-trait" />
      <path className="g-fleche" d="M104 45h34" />
      <path className="g-fleche" d="M132 38l7 7-7 7" />
      <rect x="152" y="14" width="72" height="62" rx="12" className="g-carte" />
      <rect x="164" y="26" width="30" height="7" rx="3.5" className="g-accent" />
      <rect x="164" y="40" width="48" height="6" rx="3" className="g-ligne" />
      <rect x="164" y="52" width="38" height="6" rx="3" className="g-ligne" />
    </svg>
  );
  if (cle === 'vente') return (
    <svg className="vrm-guide-dessin" data-guide-dessin="vente" viewBox="0 0 240 84" aria-hidden="true">
      <rect x="60" y="14" width="120" height="58" rx="12" className="g-carte" />
      <rect x="72" y="26" width="34" height="34" rx="9" className="g-case" />
      <path d="M78 46c6-1 10-6 14-8 4 3 6 6 9 7v5H78z" className="g-plein" />
      <rect x="114" y="28" width="52" height="7" rx="3.5" className="g-ligne-fort" />
      <rect x="114" y="42" width="34" height="6" rx="3" className="g-ligne" />
      <circle className="g-point" cx="164" cy="56" r="5" />
      <circle className="g-onde" cx="164" cy="56" r="5" />
    </svg>
  );
  return null;
}

// Les deux choix de la numérotation, chacun avec son petit dessin.
function DessinNumerotation({ cle }) {
  if (cle === 'vrm') return (
    <svg viewBox="0 0 96 56" aria-hidden="true" className="vrm-guide-choix-dessin">
      <path d="M14 22l34-12 34 12v24l-34 6-34-6z" className="g-case" />
      <path d="M14 22l34 8 34-8M48 30v22" className="g-trait" />
      <rect x="22" y="31" width="20" height="11" rx="3" className="g-num" />
      <text x="32" y="39.5" textAnchor="middle" className="g-num-texte">12</text>
    </svg>
  );
  return (
    <svg viewBox="0 0 96 56" aria-hidden="true" className="vrm-guide-choix-dessin">
      <rect x="12" y="6" width="72" height="44" rx="8" className="g-carte" />
      <rect x="20" y="14" width="44" height="5" rx="2.5" className="g-ligne-fort" />
      <rect x="20" y="24" width="56" height="4" rx="2" className="g-ligne" />
      <rect x="20" y="31" width="40" height="4" rx="2" className="g-ligne" />
      <rect x="20" y="37" width="36" height="10" rx="5" className="g-accent-doux" />
      <text x="38" y="44.6" textAnchor="middle" className="g-accent-texte">N° 123</text>
    </svg>
  );
}

export function ChoixNumerotation({ choix, onChoisir, onPlusTard, mot = 'paires' }) {
  return (
    <div className="vrm-guide-question" data-guide-numerotation="" role="group" aria-labelledby="vrm-guide-question-titre">
      <p id="vrm-guide-question-titre" className="vrm-guide-question-titre">Qui écrit le numéro de tes {mot}&nbsp;?</p>
      <div className="vrm-guide-choix">
        {choix.map((c) => (
          <button key={c.cle} type="button" className="vrm-guide-choix-carte" data-guide-numerotation-choix={c.cle} onClick={() => onChoisir && onChoisir(c.cle)}>
            <DessinNumerotation cle={c.cle} />
            <span className="vrm-guide-choix-titre">{c.titre}</span>
            <span className="vrm-guide-choix-texte">{c.texte}</span>
          </button>
        ))}
      </div>
      <div className="vrm-guide-question-pied">
        <span>Modifiable ensuite dans Paramètres → Numéros de rangement.</span>
        {onPlusTard ? <button type="button" className="vrm-b vrm-b-discret" data-guide-numerotation-plus-tard="" onClick={onPlusTard}>Plus tard</button> : null}
      </div>
    </div>
  );
}

const ETAT_VERIF = { ok: 'OK', action: 'À faire', passu: 'Pas su', encours: '…' };
export function VerificationInstallation({ verif, onGeste, lienGeste = () => '', onFermer = null }) {
  if (!verif) return null;
  return (
    <div className="vrm-verif" data-verif-installation="" data-verif-afaire={verif.aFaire} data-verif-passu={verif.passu} data-verif-ok={verif.toutVaBien ? '1' : '0'}>
      <div className="vrm-verif-tete">
        <p className="vrm-verif-titre">{verif.toutVaBien ? 'Tout est en place.' : verif.passu && !verif.aFaire ? 'Je vérifie…' : verif.aFaire === 1 ? 'Une chose à régler.' : `${verif.aFaire} choses à régler.`}</p>
        {onFermer ? <button type="button" className="vrm-b vrm-b-discret" onClick={onFermer}>Fermer</button> : null}
      </div>
      <ul className="vrm-verif-liste">
        {verif.lignes.map((l) => {
          const href = l.geste ? lienGeste(l.geste.cle) : '';
          return (
            <li key={l.cle} className="vrm-verif-rangee" data-verif={l.cle} data-etat={l.etat}>
              <span className="vrm-verif-marque" aria-hidden="true">{l.etat === 'ok' ? <Coche /> : null}</span>
              <div className="vrm-verif-corps">
                <div className="vrm-verif-ligne"><span className="vrm-verif-nom">{l.titre}</span><span className="vrm-verif-etat">{ETAT_VERIF[l.etat]}</span></div>
                <p className="vrm-verif-detail">{l.detail}</p>
                {l.geste ? (href
                  ? <a className="vrm-b vrm-b-secondaire vrm-verif-geste" data-verif-geste={l.geste.cle} href={href} target={/^https?:/.test(href) ? '_blank' : undefined} rel="noreferrer" download={/\.zip(\?|$)/.test(href) ? '' : undefined}>{l.geste.libelle}</a>
                  : <button type="button" className="vrm-b vrm-b-secondaire vrm-verif-geste" data-verif-geste={l.geste.cle} onClick={() => onGeste && onGeste(l.geste.cle)}>{l.geste.libelle}</button>) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GuideDemarrage({ guide, nav = '', detail = null, gestes = {}, onExemple = null, onMasquer = null, onVerifier = null, onPlusTard = null, numerotation = null, verification = null, onOuvrirVerification = null, Pop = null }) {
  if (!guide) return null;
  const { etapes, faites, total, courante } = guide;
  return (
    <section className="vrm-guide" data-guide-demarrage="" data-guide-faites={faites} data-guide-courante={courante || ''} aria-labelledby="vrm-guide-titre">
      <div className="vrm-guide-tete">
        <h2 id="vrm-guide-titre" className="vrm-guide-titre">Démarrer avec VRM</h2>
        <span className="vrm-guide-compte" data-guide-progres={`${faites}/${total}`}>{faites} sur {total}</span>
      </div>
      <p className="vrm-guide-sous">Une dizaine de minutes. Chaque étape se coche toute seule quand c’est fait.</p>
      <div className="vrm-guide-barre" role="progressbar" aria-label="Étapes faites" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}>
        {etapes.map((e) => <span key={e.cle} data-fait={e.etat === 'fait' ? '1' : '0'} data-ici={e.cle === courante ? '1' : '0'} />)}
      </div>
      {numerotation}
      <ol className="vrm-guide-etapes">
        {etapes.map((e, i) => {
          const ici = e.cle === courante;
          const geste = gestes[e.cle];
          const ouverte = ici && e.etat !== 'fait';
          return (
            <li key={e.cle} className="vrm-guide-etape" data-guide-etape={e.cle} data-etat={e.etat} data-courante={ici ? '1' : '0'} data-reportee={e.reportee ? '1' : '0'} aria-current={ici ? 'step' : undefined}>
              <span className="vrm-guide-marque" aria-hidden="true">{e.etat === 'fait' ? <Coche /> : i + 1}</span>
              <div className="vrm-guide-corps">
                <div className="vrm-guide-ligne">
                  <span className="vrm-guide-nom">{e.cle === 'extension' && nav ? `${e.titre} ${nav}` : e.titre}</span>
                  {ETAT_MOT[e.etat] ? <span className="vrm-guide-etat" data-guide-etat-mot={e.etat}>{ETAT_MOT[e.etat]}</span>
                    : e.reportee ? <span className="vrm-guide-etat" data-guide-etat-mot="plus-tard">Plus tard</span> : null}
                </div>
                {ouverte && (
                  <div className="vrm-guide-ouverte" key={e.cle}>
                    {(e.cle === 'emails' || e.cle === 'vente') && <IllustrationEtape cle={e.cle} />}
                    {/* (9 nov., lot AI) Le « pourquoi » en pop-up (une ligne « Pourquoi ? » + ⓘ) quand l'app fournit `Pop`. */}
                    {Pop ? <Pop nom={'guide-' + e.cle} titre={e.titre} resume="Pourquoi cette étape ?" style={{ margin: '0 0 6px' }}><p className="vrm-guide-pourquoi">{e.pourquoi}</p></Pop>
                      : <p className="vrm-guide-pourquoi">{e.pourquoi}</p>}
                    {(e.cle === 'extension' || e.cle === 'vinted') && detail ? <div className="vrm-guide-detail" data-guide-detail={e.cle}>{detail}</div> : null}
                    {e.etat === 'passu' && onVerifier ? <button type="button" className="vrm-b vrm-b-secondaire" onClick={onVerifier}>Réessayer la vérification</button> : null}
                    {(geste && e.etat !== 'passu' && e.etat !== 'encours') || (onPlusTard && !e.attente) ? (
                      <div className="vrm-guide-geste">
                        {geste && e.etat !== 'passu' && e.etat !== 'encours' ? <button type="button" className="vrm-b vrm-b-primaire" data-guide-geste={e.cle} onClick={geste.onClick}>{geste.libelle}</button> : null}
                        {onPlusTard && !e.attente ? <button type="button" className="vrm-b vrm-b-discret" data-guide-plus-tard={e.cle} onClick={() => onPlusTard(e.cle)}>Plus tard</button> : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {verification}
      {(onExemple || onMasquer || onOuvrirVerification) && (
        <div className="vrm-guide-pied">
          {onExemple ? (
            <div className="vrm-guide-exemple">
              <p>Pas encore prêt&nbsp;? Regarde VRM rempli de données inventées. Rien n’est enregistré.</p>
              <button type="button" className="vrm-b vrm-b-secondaire" data-exemple-entrer="" onClick={onExemple}>Voir VRM avec des exemples</button>
            </div>
          ) : null}
          <div className="vrm-guide-pied-gestes">
            {onOuvrirVerification ? <button type="button" className="vrm-b vrm-b-discret" data-guide-verifier="" onClick={onOuvrirVerification}>Vérifier mon installation</button> : null}
            {onMasquer ? <button type="button" className="vrm-b vrm-b-discret" data-guide-masquer="" onClick={onMasquer}>Masquer le guide</button> : null}
          </div>
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
      <button type="button" className="vrm-b vrm-b-primaire" data-exemple-brancher="" onClick={onBrancher}>Passer à mes vraies données</button>
    </div>
  );
}
