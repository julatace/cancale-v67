// ── src/natif/FiltrePlateformes.jsx — le filtre « Toutes · Vinted · Leboncoin · eBay · Vestiaire » d'un onglet (25 nov.) ──
// Julien : « On doit avoir un filtre avec toutes les plateformes et par plateforme dans les onglets. » — « laisse le design
// de l'app actuel ». Aucune forme neuve :
//   · au téléphone, LA RANGÉE DE PUCES d'Annonces (`.n-ad-puces` / `.n-ad-puce`, src/natif/visuel/inventaire.css : défile de
//     côté, 44 au doigt, la pilule 32), chaque puce avec le VRAI logo du site (`LogoSite`) et son nombre ;
//   · à l'ordinateur, une entrée du menu de filtres EXISTANT du tableau de travail (`filtreTableau`, le logo dans le menu).
// La règle (quelle ligne est de quel site, quelles entrées, le choix retenu) : src/filtrePlateforme.js — une seule.
// `useFiltrePlateforme(ecran)` : [choix, choisir] — le choix de CET appareil pour CET écran, partagé entre les morceaux d'un
// même écran (Ventes : À envoyer, En route, Terminées), relu au retour sur l'écran ; il ne touche à aucune donnée.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Puce } from './Puce.jsx';
import { LogoSite } from './LogoSite.jsx';
import { nomPlateforme } from '../plateformes.js';
import { TOUTES, lireChoixPlateforme, ecrireChoixPlateforme } from '../filtrePlateforme.js';
import './visuel/inventaire.css';

const EVT = 'vrm:filtre-plateforme';

export function useFiltrePlateforme(ecran) {
  const [choix, setChoix] = React.useState(() => lireChoixPlateforme(ecran));
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.ecran === ecran) setChoix(d.choix); };
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, [ecran]);
  const choisir = React.useCallback((c) => {
    setChoix(c);
    ecrireChoixPlateforme(ecran, c);
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { ecran, choix: c } })); } catch (_) { /* rien : le choix reste posé ici */ }
  }, [ecran]);
  return [choix, choisir];
}

const nom = (cle) => (cle === TOUTES ? tr('fp.toutes') : nomPlateforme(cle));

// La rangée du téléphone. `options` : optionsPlateformes(…) ; vide ⇒ rien (moins de deux sites : rien à filtrer).
export function FiltrePlateformes({ ecran, options, valeur, onChange, className = '' }) {
  if (!Array.isArray(options) || options.length < 3) return null;
  return (
    <div className={'n-ad-puces n-fp' + (className ? ' ' + className : '')} role="toolbar" aria-label={tr('fp.libelle')} data-fp={ecran} data-fp-choix={valeur}>
      {options.map((o) => {
        const choisi = o.cle === valeur;
        const n = Number.isFinite(o.n) ? o.n : null;
        return (
          <Puce key={o.cle} className="n-ad-puce" presse={choisi} onClick={() => { if (!choisi) onChange(o.cle); }}
            attrs={{ 'data-fp-site': o.cle, 'data-fp-n': n != null ? String(n) : undefined, 'aria-label': n != null ? nom(o.cle) + ' · ' + n : nom(o.cle) }}>
            <span className="n-ad-puce-pilule">
              {o.cle === TOUTES ? null : <LogoSite site={o.cle} taille={16}/>}
              {o.cle === 'ebay' ? null : nom(o.cle)}
              {n != null ? <span className="n-ad-puce-n">{n}</span> : null}
            </span>
          </Puce>
        );
      })}
    </div>
  );
}

// L'entrée du menu de filtres du tableau de travail (ordinateur) : la MÊME liste, le logo devant chaque site.
// Une entrée de ce menu : son nom et son logo (le nombre, l'écran le pose de SA règle).
export const optionTableau = (cle) => ({ cle, libelle: nom(cle), icone: cle === TOUTES ? null : <LogoSite site={cle} taille={16}/> });
export function filtreTableau(options, valeur, onChange) {
  if (!Array.isArray(options) || options.length < 3) return null;
  return { cle: 'site', libelle: tr('tableau.col.site'), valeur, onChange,
    options: options.map((o) => ({ ...optionTableau(o.cle), n: Number.isFinite(o.n) ? o.n : undefined })) };
}

// « Leboncoin seulement » : la phrase d'un nombre filtré (un total partiel ne se présente jamais comme complet, §5).
export const phraseFiltre = (choix) => (choix && choix !== TOUTES ? tr('fp.seulement', { site: nomPlateforme(choix) }) : '');

export default FiltrePlateformes;
