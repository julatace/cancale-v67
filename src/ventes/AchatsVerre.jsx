// ════════════════════════════════════════════════════════════════════════════
//  ACHATS · « VERRE DÉPOLI » — LE CODE AU COMPTOIR (15 nov., maquette validée)
//  Une feuille claire, le code en très grand, chiffre par chiffre dans des cases
//  (lisible par l'employé du point relais), le point relais et l'échéance, la paire
//  attendue ; « Je l'ai retiré » (le MÊME geste que la ligne : `retirer(x)`),
//  « Itinéraire » (le plan, par l'adresse LUE), « Copier le code ». Rien n'est
//  deviné : un champ pas lu n'est pas écrit. Styles : src/design/ventes-verre.css.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { IconeV } from './VentesVerre.jsx';

export function CodeComptoir({ code, lieu = '', adresse = '', plan = null, transporteur = '', echeance = '', echeanceAmbre = false, titre = '', photo = null, sous = '', onRetire = null, onFermer }) {
  const [copie, setCopie] = React.useState(false);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onFermer && onFermer(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onFermer]);
  const copier = async () => { try { await navigator.clipboard.writeText(String(code)); setCopie(true); } catch (_) { setCopie(false); } };
  const corps = (
    <div className="va-voile" data-va-comptoir-voile="" onClick={(e) => { if (e.target === e.currentTarget) onFermer && onFermer(); }}>
      <div className="va-feuille" role="dialog" aria-modal="true" aria-label={tr('va.comptoir.titre')} data-va-comptoir={code}>
        <span className="va-grab" aria-hidden="true"/>
        <button type="button" className="va-fx" aria-label={tr('va.comptoir.fermer')} onClick={onFermer}><IconeV nom="x" taille={18} trait={2.2}/></button>
        <p className="va-fc-t">{tr('va.comptoir.titre')}</p>
        <div className="va-fc-code vrm-sensible" data-stream-type="code" data-va-code-cases={String(code).length} aria-label={String(code).split('').join(' ')}>
          {String(code).split('').map((c, i) => <i key={i} aria-hidden="true">{c}</i>)}
        </div>
        <p className="va-fc-l"><IconeV nom="sun" taille={15}/>{tr('va.comptoir.lumiere')}</p>
        {(lieu || titre) ? <div className="va-fc-b">
          {lieu ? <div className="va-fc-rw"><span className="vv-tui is-ac"><IconeV nom="store" taille={20} trait={1.9}/></span>
            <span className="va-fc-mid"><b>{lieu}</b>{adresse || transporteur ? <span>{[adresse, transporteur].filter(Boolean).join(' · ')}</span> : null}</span>
            {echeance ? <span className={'va-fc-end' + (echeanceAmbre ? ' vv-am' : '')}>{echeance}</span> : null}</div> : null}
          {titre ? <div className="va-fc-rw">{photo ? <span className="va-fc-ph">{photo}</span> : <span className="vv-tui"><IconeV nom="box" taille={20} trait={1.9}/></span>}
            <span className="va-fc-mid"><b>{titre}</b>{sous ? <span>{sous}</span> : null}</span></div> : null}
        </div> : null}
        {onRetire ? <button type="button" className="sb-btn-plein vv-plein va-fc-plein" data-colis-retire="" data-va-retire="" onClick={() => { onRetire(); onFermer && onFermer(); }}>
          <IconeV nom="check" taille={20} trait={2.2}/><span className="sb-btn-plein-mot">{tr('va.comptoir.retire')}</span></button> : null}
        <div className="va-fc-duo">
          {plan ? <a className="sb-touche vv-touche" href={plan} target="_blank" rel="noreferrer" data-va-itineraire=""><IconeV nom="route" taille={18} trait={1.9}/>{tr('va.comptoir.itineraire')}</a> : null}
          <button type="button" className="sb-touche vv-touche" data-va-copier="" onClick={copier}><IconeV nom="copy" taille={18} trait={1.9}/>{copie ? tr('va.comptoir.copie') : tr('va.comptoir.copier')}</button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}
