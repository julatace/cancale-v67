// ══════════════════════════════════════════════════════════════════════════════
//  « ME LE RAPPELER » — la FORME seulement (11 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (forme d'un rappel, jours, état de la cible, notification) est
// api/_lib/rappels-perso.js ; l'état et les gestes (`HoteRappels`, `BoutonRappel`,
// `RappelsSetting`, App.jsx) passent ici ce qu'il faut montrer :
//   · `FeuilleRappel`   : quand (demain matin · 3 jours · 7 jours · une date) + une
//                         note courte facultative (choix rapides) ; « Enregistrer » ;
//   · `CarteRappelsJour`: Ma journée — les rappels du jour, « Fait » · « Reporter » · « Supprimer » ;
//   · `ListeRappels`    : Paramètres → Rappels — aujourd'hui, à venir, faits ;
//   · `BandeauRappel`   : ouvert par la notification — l'état de la cible (« vendu
//                         entre-temps ») au lieu d'un écran vide.
// Neutre (§7) : un rappel n'est pas une alerte — ni ambre, ni rouge. Rien n'est
// créé sans « Enregistrer » (jamais proposé par VRM : refus du 11 oct., §3).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './styles-rappels.css';
import { CHOIX_QUAND, NOTES_RAPIDES, NOTE_MAX, jourDuChoix, jourParis, ajouterJours, quandEnMots, objetRappel } from '../api/_lib/rappels-perso.js';

export function IconeRappel({ size = 18 }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="vrm-rp-icone">
      <circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.8M5 4.5 3 6.5M19 4.5l2 2"/>
    </svg>
  );
}
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// La feuille. `mode` : 'creer' (quand + note) · 'reporter' (quand seul).
export function FeuilleRappel({ Feuille, cible, libelle = '', existant = null, mode = 'creer', onEnregistrer, onFermer, maintenant = Date.now() }) {
  const [choix, setChoix] = React.useState(mode === 'reporter' ? '' : 'demain');
  const [date, setDate] = React.useState('');
  const [note, setNote] = React.useState(mode === 'reporter' ? '' : (existant && existant.note) || '');
  const auj = jourParis(maintenant);
  const choixEffectif = choix === 'date' ? date : choix;
  const jour = jourDuChoix(choixEffectif, maintenant);
  const rapides = NOTES_RAPIDES[cible && cible.sorte] || [];
  const titre = mode === 'reporter' ? 'Reporter le rappel' : 'Me le rappeler';
  const sous = libelle || (cible ? capital(objetRappel(cible)) : '');
  return (
    <Feuille onClose={onFermer} titre={titre} sousTitre={sous || undefined} data-rappel-feuille={mode} maxWidth={440}>
      <div className="vrm-rp-feuille">
        {existant && mode === 'creer' ? <p className="vrm-rp-deja" data-rappel-deja={existant.id}>Déjà prévu {quandEnMots(existant.jour, maintenant)} : l’enregistrer le remplace.</p> : null}
        <fieldset className="vrm-rp-quand">
          <legend>Quand</legend>
          {CHOIX_QUAND.map((c) => (
            <button key={c.id} type="button" className="vrm-rp-choix" aria-pressed={choix === c.id} data-rappel-choix={c.id} onClick={() => setChoix(c.id)}>
              <b>{c.lib}</b><small>{capital(quandEnMots(ajouterJours(auj, c.jours), maintenant))} · 9 h</small>
            </button>
          ))}
          <label className={'vrm-rp-choix vrm-rp-date' + (choix === 'date' ? ' is-choisi' : '')} data-rappel-choix="date">
            <b>Une date</b>
            <input type="date" min={auj} value={date} aria-label="Date du rappel" data-rappel-date="" onFocus={() => setChoix('date')} onChange={(e) => { setDate(e.target.value); setChoix('date'); }}/>
          </label>
        </fieldset>
        {mode === 'creer' ? <>
          <label className="vrm-rp-note">
            <span>Note <small>facultative</small></span>
            <input type="text" value={note} maxLength={NOTE_MAX} placeholder="Par exemple : rebaisser le prix" data-rappel-note="" onChange={(e) => setNote(e.target.value)}/>
          </label>
          {rapides.length ? <div className="vrm-rp-rapides" role="group" aria-label="Notes rapides">
            {rapides.map((t) => <button key={t} type="button" className="vrm-rp-rapide" aria-pressed={note === t} data-rappel-rapide={t} onClick={() => setNote(note === t ? '' : t)}>{t}</button>)}
          </div> : null}
        </> : null}
        <p className="vrm-rp-quand-dit" data-rappel-jour={jour || ''}>{jour ? <>Une notification <b>{quandEnMots(jour, maintenant)}</b> à 9 h, et la carte dans Ma journée.</> : choix === 'date' ? 'Choisis une date (aujourd’hui ou plus tard).' : 'Choisis quand.'}</p>
      </div>
      <div className="vrm-fs-pied">
        <button type="button" className="vrm-rp-enregistrer" data-rappel-enregistrer="" disabled={!jour} onClick={() => jour && onEnregistrer({ choix: choixEffectif, note })}>{mode === 'reporter' ? 'Reporter' : 'Enregistrer'}</button>
      </div>
    </Feuille>
  );
}

// Une ligne de rappel (carte du jour, liste des Paramètres).
function LigneRappel({ r, etat, maintenant, onOuvrir, onFait, onReporter, onSupprimer, enRetard }) {
  const obj = objetRappel(r);
  return (
    <li className="vrm-rp-ligne" data-rappel={r.id} data-rappel-sorte={r.sorte} data-rappel-etat-cible={etat ? etat.etat : ''} data-rappel-statut={r.etat}>
      <button type="button" className="vrm-rp-ouvrir" data-rappel-ouvrir={r.id} onClick={() => onOuvrir(r)} aria-label={`Ouvrir ${obj}${r.note ? ' — ' + r.note : ''}`}>
        <span className="vrm-rp-obj">{capital(obj)}{r.note ? <> · <span className="vrm-rp-texte">{r.note}</span></> : null}</span>
        <small className="vrm-rp-sous">
          {r.etat === 'fait' ? 'Fait' : enRetard ? `Prévu ${quandEnMots(r.jour, maintenant)}` : capital(quandEnMots(r.jour, maintenant))}
          {etat && etat.phrase ? <> · <span data-rappel-phrase="">{etat.phrase}</span></> : null}
        </small>
      </button>
      {r.etat === 'actif' ? <span className="vrm-rp-gestes">
        {onFait ? <button type="button" className="vrm-rp-geste" data-rappel-fait={r.id} onClick={() => onFait(r)}>Fait</button> : null}
        <button type="button" className="vrm-rp-geste" data-rappel-reporter={r.id} onClick={() => onReporter(r)}>Reporter</button>
        <button type="button" className="vrm-rp-geste is-discret" data-rappel-supprimer={r.id} aria-label={`Supprimer le rappel ${obj}`} onClick={() => onSupprimer(r)}>Supprimer</button>
      </span> : null}
    </li>
  );
}

// Ma journée : « Rappels du jour » — seulement s'il y en a.
export function CarteRappelsJour({ lignes, maintenant = Date.now(), ...gestes }) {
  if (!lignes || !lignes.length) return null;
  const auj = jourParis(maintenant);
  return (
    <section className="vrm-rp-carte" id="vrm-rappels-jour" data-rappels-jour={lignes.length} aria-labelledby="vrm-rp-carte-titre">
      <h3 id="vrm-rp-carte-titre"><IconeRappel size={18}/><span>Rappels du jour</span><small>{lignes.length}</small></h3>
      <ul className="vrm-rp-liste">
        {lignes.map(({ r, etat }) => <LigneRappel key={r.id} r={r} etat={etat} maintenant={maintenant} enRetard={r.jour < auj} {...gestes}/>)}
      </ul>
    </section>
  );
}

// Paramètres → Rappels.
export function ListeRappels({ duJour = [], avenir = [], faits = [], maintenant = Date.now(), ...gestes }) {
  const auj = jourParis(maintenant);
  if (!duJour.length && !avenir.length && !faits.length) {
    return <div className="vrm-rp-vide" data-rappels-liste="0"><IconeRappel size={22}/><p>Aucun rappel. Pose-en un avec « Me le rappeler » sur la fiche d’un article, d’une vente ou d’un achat.</p></div>;
  }
  const bloc = (titre, lignes, cle, avecFait = true) => (lignes.length ? <section className="vrm-rp-bloc" data-rappels-bloc={cle}>
    <h4>{titre}</h4>
    <ul className="vrm-rp-liste">{lignes.map(({ r, etat }) => <LigneRappel key={r.id} r={r} etat={etat} maintenant={maintenant} enRetard={r.etat === 'actif' && r.jour < auj} {...gestes} onFait={avecFait ? gestes.onFait : null}/>)}</ul>
  </section> : null);
  return (
    <div className="vrm-rp-params" data-rappels-liste={duJour.length + avenir.length}>
      {bloc('Aujourd’hui', duJour, 'jour')}
      {bloc('À venir', avenir, 'avenir', false)}
      {bloc('Faits ces 30 derniers jours', faits.slice(0, 20), 'faits')}
      <p className="vrm-rp-pied">À 9 h le jour choisi (après tes heures calmes). Synchronisés sur tes appareils.</p>
    </div>
  );
}

// Ouvert par la notification (ou « Ouvrir ») : ce qui se passe, et les gestes.
export function BandeauRappel({ r, etat, maintenant = Date.now(), onFait, onReporter, onHistoire, onFermer }) {
  if (!r) return null;
  const obj = objetRappel(r);
  const vide = etat && (etat.etat === 'vendu' || etat.etat === 'parti' || etat.etat === 'annulee');
  return (
    <div className="vrm-rp-bandeau" role="status" data-rappel-bandeau={r.id} data-rappel-etat-cible={etat ? etat.etat : ''}>
      <IconeRappel size={20}/>
      <div className="vrm-rp-bandeau-txt">
        <b>Rappel · {obj}{r.note ? ` · ${r.note}` : ''}</b>
        <small>{r.etat === 'fait' ? 'Déjà fait.' : r.etat === 'supprime' ? 'Ce rappel a été supprimé.' : vide ? etat.phrase : `Prévu ${quandEnMots(r.jour, maintenant)}.`}</small>
      </div>
      <span className="vrm-rp-gestes">
        {vide && onHistoire ? <button type="button" className="vrm-rp-geste" data-rappel-histoire={r.id} onClick={() => onHistoire(r, etat)}>{etat.etat === 'vendu' && etat.tx ? 'Voir la vente' : 'Voir son histoire'}</button> : null}
        {r.etat === 'actif' ? <button type="button" className="vrm-rp-geste" data-rappel-fait={r.id} onClick={() => onFait(r)}>Fait</button> : null}
        {r.etat === 'actif' ? <button type="button" className="vrm-rp-geste" data-rappel-reporter={r.id} onClick={() => onReporter(r)}>Reporter</button> : null}
        <button type="button" className="vrm-rp-geste is-discret" aria-label="Fermer" data-rappel-bandeau-fermer="" onClick={onFermer}>×</button>
      </span>
    </div>
  );
}

// Le bouton « Me le rappeler » (fiche, menu « … »).
export function BoutonRappelVue({ actif = null, onClick, variante = 'bloc', maintenant = Date.now() }) {
  return (
    <button type="button" className={'vrm-rp-bouton' + (variante === 'ligne' ? ' is-ligne' : '')} data-rappel-bouton={actif ? 'actif' : 'neuf'} onClick={onClick}
      aria-label={actif ? `Rappel prévu ${quandEnMots(actif.jour, maintenant)} — le modifier` : 'Me le rappeler'}>
      <IconeRappel size={17}/><span>{actif ? `Rappel ${quandEnMots(actif.jour, maintenant)}` : 'Me le rappeler'}</span>
    </button>
  );
}
