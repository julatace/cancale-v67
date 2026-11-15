// ════════════════════════════════════════════════════════════════════════════
//  « DANS UNE AUTRE TAILLE » — la feuille (14 nov., idée 157). La règle : ./autreTaille.js.
//  Depuis la fiche d'une paire : il tape la nouvelle taille ; l'aperçu montre le titre et
//  la description copiés, la taille changée là où elle est marquée (compté), l'étiquette
//  de l'ancien N° retirée, un autre N° du texte SIGNALÉ ; il relit et corrige.
//  « Créer la fiche » : une fiche « À publier », un N° NEUF (`prochainLibre`, donné par
//  l'écran au moment de la création — jamais avant, jamais un ancien), photos à prendre.
//  Ensuite « Créer sur Vinted », le chemin d'avant. Rien ne part vers Vinted ici.
//  `bloque` : la raison pour laquelle VRM ne peut pas donner de N° (« Je numérote moi-même »,
//  numéros pas chargés) — dite en haut, le bouton éteint.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { copieAutreTaille } from './autreTaille.js';
import '../paireHistoire/idees.css';

const RAISON = { 'taille-vide': 'at.raison.vide', 'taille-longue': 'at.raison.longue', 'meme-taille': 'at.raison.meme' };

// src : les champs de l'annonce (`champsADupliquer`) · numero : son N° · onCreer(champs) → { ok, numero } | { ok:false, raison }
export default function AutreTaille({ src, numero = '', bloque = '', onCreer, onFermer, Retour = null }) {
  const [taille, setTaille] = React.useState('');
  const [titre, setTitre] = React.useState(null);
  const [desc, setDesc] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const s = src || {};
  const c = copieAutreTaille(s, { numeroOrigine: numero, nouvelle: taille });
  const titreV = titre != null ? titre : (c.ok ? c.champs.titre : String(s.titre || ''));
  const descV = desc != null ? desc : (c.ok ? c.champs.description : String(s.description || ''));
  const pret = !bloque && c.ok && titreV.trim() && !enCours;
  const nChanges = c.ok ? c.changes.titre + c.changes.description : 0;
  const creer = async () => {
    if (!pret) return;
    setEnCours(true); setErreur('');
    let r = null;
    try { r = await onCreer({ taille: c.champs.taille, titre: titreV.trim(), description: descV }); } catch (_) { r = null; }
    setEnCours(false);
    if (!r || !r.ok) setErreur((r && r.raison) || tr('at.raison.inconnue'));
  };
  const corps = (
    <div className="vrm-idees vrm-idees-voile" onClick={onFermer} data-autre-taille={numero}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-idees-feuille" role="dialog" aria-modal="true" aria-label={tr('at.titre')} onClick={(e) => e.stopPropagation()}>
        <div className="vrm-idees-tete">
          <h3>{tr('at.titre')}</h3>
          <button type="button" className="sb-rond" aria-label={tr('at.fermer')} data-at-fermer="" onClick={onFermer}>×</button>
        </div>
        <p className="vrm-idees-sous" data-at-source={numero}>{[numero ? `N°${numero}` : '', s.titre || '', s.taille ? tr('at.tailleDe', { t: s.taille }) : ''].filter(Boolean).join(' · ')}</p>
        {bloque ? <p className="vrm-idees-dit is-geste" role="alert" data-at-bloque="">{bloque}</p> : <p className="vrm-idees-dit" data-at-regle="">{tr('at.regle')}</p>}
        <label className="vrm-idees-champ">
          <span>{tr('at.nouvelle')}</span>
          <input type="text" inputMode="decimal" value={taille} maxLength={20} data-at-taille="" disabled={!!bloque} onChange={(e) => { setTaille(e.target.value); setTitre(null); setDesc(null); }} placeholder={s.taille || '43'}/>
        </label>
        {taille.trim() && !c.ok ? <p className="vrm-idees-dit is-geste" data-at-raison={c.raison}>{tr(RAISON[c.raison] || 'at.raison.inconnue')}</p> : null}
        {c.ok ? (<>
          <p className="vrm-idees-dit" data-at-changes={`${c.changes.titre},${c.changes.description}`} data-at-etiquette={c.etiquetteRetiree}>
            {nChanges ? tr('at.changes', { n: nChanges }) : tr('at.changesAucun')}{c.etiquetteRetiree ? ` · ${tr('at.etiquette', { num: numero })}` : ''}
          </p>
          {c.autresNumeros.length ? <p className="vrm-idees-dit is-geste" role="alert" data-at-autres-numeros={c.autresNumeros.join(',')}>{tr('at.autresNumeros', { nums: c.autresNumeros.map((k) => 'N°' + k).join(', ') })}</p> : null}
          <label className="vrm-idees-champ"><span>{tr('at.titreChamp')}</span>
            <input type="text" value={titreV} maxLength={100} data-at-titre="" onChange={(e) => setTitre(e.target.value)}/></label>
          <label className="vrm-idees-champ"><span>{tr('at.description')}</span>
            <textarea value={descV} maxLength={5000} data-at-description="" onChange={(e) => setDesc(e.target.value)}/></label>
          <p className="vrm-idees-dit" data-at-numero-neuf="">{tr('at.numeroNeuf')}</p>
        </>) : null}
        {erreur ? <p className="vrm-idees-dit is-geste" role="alert" data-at-erreur="">{erreur}</p> : null}
        <div className="vrm-idees-pied">
          <button type="button" className="sb-touche" onClick={onFermer}>{tr('at.annuler')}</button>
          <button type="button" className="sb-btn-plein sb-btn-plein--barre" disabled={!pret} data-at-creer="" onClick={creer}>{enCours ? tr('at.enCours') : tr('at.creer')}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? corps : createPortal(corps, document.body);
}
