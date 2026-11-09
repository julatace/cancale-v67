import React from 'react';
import { PLATEFORMES } from './plateformes.js';
import './styles-choix-plateformes.css';
export default function ChoixPlateformes({ valeur, relies = {}, pret, onChoix, initial = false }) {
  const [choix, setChoix] = React.useState(valeur);
  const [modifie, setModifie] = React.useState(false);
  const enCours = React.useRef(false);
  const [occupe, setOccupe] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  React.useEffect(() => { if (!modifie) setChoix(valeur); }, [valeur.join('|'), modifie]);
  const basculer = id => { setModifie(true); setErreur(''); setChoix(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]); };
  return <section className="vrm-choix-plateformes" data-choix-plateformes={initial ? 'demarrage' : 'reglages'} aria-label="Mes plateformes">
    <div className="vrm-cp-tete"><div>{initial ? <h2>Où vends-tu ?</h2> : null}<p>Affiche uniquement les plateformes dont tu as besoin.</p></div></div>
    <div className="vrm-cp-grille">{PLATEFORMES.map(p => <button type="button" key={p.id} aria-pressed={choix.includes(p.id) || relies[p.id] === true} data-choix-plateforme={p.id} onClick={() => basculer(p.id)} disabled={!pret || occupe || relies[p.id] === true} title={relies[p.id] === true ? 'Un compte est déjà relié : cette plateforme reste accessible.' : undefined}>
      <span className="vrm-cp-logo" aria-hidden="true" style={{'--vrm-cp-logo':`url("${p.logo}")`}}/><span><b>{p.nom}</b><small>{relies[p.id] === true ? 'Compte relié' : choix.includes(p.id) ? 'Affichée' : 'Masquée'}</small></span><span className="vrm-cp-coche" aria-hidden="true">{choix.includes(p.id) || relies[p.id] === true ? '✓' : '+'}</span>
    </button>)}</div>
    <p className="vrm-cp-note">Tu pourras en ajouter dans Paramètres → Affichage → Mes plateformes. Connecter un compte avec l’extension l’affiche aussi automatiquement. Masquer une plateforme ne supprime aucune donnée et ne change aucun total.</p>
    {erreur ? <p role="alert">{erreur}</p> : null}
    <button className="vrm-b vrm-b-primaire" type="button" disabled={!pret || occupe} aria-busy={occupe || undefined} onClick={async () => {
      if (enCours.current) return;
      if (!choix.length && !Object.values(relies).some(v => v === true)) { setErreur('Choisis au moins une plateforme pour continuer.'); return; }
      enCours.current = true; setOccupe(true);
      try { await onChoix(choix); setModifie(false); setErreur(''); }
      catch (_) { setErreur('Le choix n’a pas pu être enregistré. Tes sélections sont conservées ; réessaie.'); }
      finally { enCours.current = false; setOccupe(false); }
    }}>{occupe ? 'Enregistrement…' : pret ? initial ? 'Continuer avec ces plateformes' : 'Enregistrer mes plateformes' : 'Chargement de tes préférences…'}</button>
  </section>;
}
