// ════════════════════════════════════════════════════════════════════════════
//  « REMPLIR AVEC UN MODÈLE » — la feuille (14 nov., idée 156). La règle : ./remplir.js.
//  Pour UNE fiche « À publier » : il choisit un de SES modèles, les cases que la fiche
//  ne connaît pas sont DEMANDÉES (jamais devinées), l'aperçu montre le texte rempli
//  (le N° posé selon SES réglages, la règle de « Créer sur Vinted »), il peut le
//  retoucher, puis « Mettre dans la fiche ». Rien ne part vers Vinted ici.
//  Feuille par portail, `Retour` (FermeAuRetour) ; un seul bouton plein.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { descriptionDepuisModele, casesVides, valeursFiche } from './remplir.js';
import '../paireHistoire/idees.css';

export function ChoixModele({ modeles, choisi, onChoisir, avecTexte = false }) {
  if (!modeles.length && !avecTexte) return null;
  return (
    <div className="vrm-idees-choix" role="group" aria-label={tr('md.choix')} data-md-choix={modeles.length}>
      {avecTexte ? <button type="button" className="sb-touche" aria-pressed={!choisi} data-md-modele="" onClick={() => onChoisir(null)}>{tr('at.texteAnnonce')}</button> : null}
      {modeles.map((m) => <button key={m.id} type="button" className="sb-touche" aria-pressed={choisi === m.id} data-md-modele={m.id} onClick={() => onChoisir(m.id)}>{m.nom}</button>)}
    </div>
  );
}

// Les champs des cases vides (modèle, boîte…) : SES réponses.
export function CasesVides({ cases, reponses, onReponse }) {
  if (!cases.length) return null;
  return (<>
    <p className="vrm-idees-dit" data-md-cases={cases.join(' ')}>{tr('md.casesDit')}</p>
    {cases.map((k) => (
      <label key={k} className="vrm-idees-champ">
        <span>{tr('md.case.' + k)}</span>
        <input type="text" value={reponses[k] || ''} maxLength={60} data-md-case={k} onChange={(e) => onReponse(k, e.target.value)} placeholder={tr('md.case.exemple.' + k)}/>
      </label>
    ))}
  </>);
}

export default function RemplirModele({ fiche, modeles = [], reglages = {}, onPoser, onFermer, onGerer = null, Retour = null }) {
  const [choisi, setChoisi] = React.useState(modeles.length === 1 ? modeles[0].id : null);
  const [reponses, setReponses] = React.useState({});
  const [texte, setTexte] = React.useState(null);   // null : l'aperçu suit le modèle ; sinon SA retouche
  const m = modeles.find((x) => x.id === choisi) || null;
  const r = m ? descriptionDepuisModele(m, fiche, { reponses, reglages }) : null;
  const cases = m ? casesVides(m.texte, { ...valeursFiche(fiche), ...reponses }) : [];
  const apercu = texte != null ? texte : (r && r.ok ? r.description : '');
  const deja = String((fiche && fiche.description) || '').trim();
  const pret = !!(m && r && r.ok && apercu.trim());
  const corps = (
    <div className="vrm-idees vrm-idees-voile" onClick={onFermer} data-remplir-modele={fiche ? fiche.numero : ''}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-idees-feuille" role="dialog" aria-modal="true" aria-label={tr('md.titre')} onClick={(e) => e.stopPropagation()}>
        <div className="vrm-idees-tete">
          <h3>{tr('md.titre')}</h3>
          <button type="button" className="sb-rond" aria-label={tr('md.fermer')} data-md-fermer="" onClick={onFermer}>×</button>
        </div>
        <p className="vrm-idees-sous">{fiche && fiche.numero ? `N°${fiche.numero}` : ''}{fiche && fiche.titre ? ` · ${fiche.titre}` : ''}</p>
        {!modeles.length ? (<>
          <p className="vrm-idees-dit" data-md-aucun="">{tr('md.aucun')}</p>
          {onGerer ? <button type="button" className="sb-lien" data-md-gerer="" onClick={onGerer}>{tr('md.gerer')} ›</button> : null}
        </>) : (<>
          <ChoixModele modeles={modeles} choisi={choisi} onChoisir={(id) => { setChoisi(id); setTexte(null); }}/>
          {!m ? <p className="vrm-idees-dit">{tr('md.choisis')}</p> : null}
          <CasesVides cases={cases} reponses={reponses} onReponse={(k, v) => { setReponses((x) => ({ ...x, [k]: v })); setTexte(null); }}/>
          {m && r && !r.ok ? <p className="vrm-idees-dit is-geste" role="alert" data-md-refus="">{r.raison === 'modele-vide' ? tr('md.vide') : r.raison}</p> : null}
          {m && r && r.ok ? (
            <label className="vrm-idees-champ">
              <span>{tr('md.apercu')}</span>
              <textarea value={apercu} maxLength={5000} data-md-apercu="" onChange={(e) => setTexte(e.target.value)}/>
            </label>
          ) : null}
          {deja && pret ? <p className="vrm-idees-dit" data-md-remplace="">{tr('md.remplace')}</p> : null}
        </>)}
        <div className="vrm-idees-pied">
          <button type="button" className="sb-touche" onClick={onFermer}>{tr('md.annuler')}</button>
          {modeles.length ? <button type="button" className="sb-btn-plein sb-btn-plein--barre" disabled={!pret} data-md-poser="" onClick={() => { onPoser(apercu.replace(/\s+$/, '')); onFermer(); }}>{tr('md.poser')}</button> : null}
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? corps : createPortal(corps, document.body);
}
