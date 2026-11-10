// ══════════════════════════════════════════════════════════════════════════
//  LOT X (10 nov.) — les trois pièces partagées par Ventes, Colis et Achats :
//   · `PucesVues`       : ses filtres enregistrés, une puce chacun (src/vuesFiltres.js) ;
//   · `BarreSelection`  : la sélection multiple et ses gestes en série (src/selectionSerie.js) ;
//   · `PanneauFiche`    : sur ordinateur (≥ 1200 px), la fiche À CÔTÉ de la liste.
// Aucun geste ne part d'ici : chaque bouton appelle la fonction que l'écran lui donne
// (la même que le geste un par un). Rien d'écrit sans son clic.
// ══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { resumeFiltres } from './vuesFiltres.js';
import './styles-vues-panneau.css';

export const SEUIL_PANNEAU = 1200;
const REQUETE_LARGE = `(min-width: ${SEUIL_PANNEAU}px)`;
const largeMaintenant = () => { try { return !!window.matchMedia && window.matchMedia(REQUETE_LARGE).matches; } catch (_) { return false; } };
export function usePanneauLarge() {
  const [large, setLarge] = React.useState(largeMaintenant);
  React.useEffect(() => {
    let mq; try { mq = window.matchMedia(REQUETE_LARGE); } catch (_) { return undefined; }
    const f = () => setLarge(mq.matches);
    f();
    if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', f); else if (mq.removeListener) mq.removeListener(f); };
  }, []);
  return large;
}

// ── Les filtres enregistrés : « Mes filtres » + une puce par combinaison ─────
export function PucesVues({ ecran, vues, actif, nomCompte, onAppliquer, onEnregistrer, onSupprimer, peutEnregistrer = true }) {
  const [gerer, setGerer] = React.useState(false);
  const liste = Array.isArray(vues) ? vues : [];
  React.useEffect(() => { if (!liste.length) setGerer(false); }, [liste.length]);
  return (
    <div className="vrm-vues-puces" data-vues-filtres={ecran} data-vues-n={liste.length} role="group" aria-label="Mes filtres enregistrés">
      <div className="vrm-vues-rangee">
        {liste.map((v) => {
          const on = actif === v.id;
          const resume = resumeFiltres(v.f, ecran, nomCompte);
          return gerer
            ? <button key={v.id} type="button" className="vrm-vue-puce is-gerer" data-vue-supprimer={v.id} aria-label={`Supprimer le filtre ${v.nom}`} onClick={() => onSupprimer && onSupprimer(v)}>
                <span className="vrm-vue-nom">{v.nom}</span><span className="vrm-vue-croix" aria-hidden="true">×</span></button>
            : <button key={v.id} type="button" className="vrm-vue-puce" data-vue-puce={v.id} data-vue-site={v.f.site} data-vue-etat={v.f.etat || ''} aria-pressed={on} title={resume} onClick={() => onAppliquer && onAppliquer(v)}>
                <span className="vrm-vue-nom">{v.nom}</span></button>;
        })}
        {gerer
          ? <button type="button" className="vrm-vue-puce is-texte" data-vues-fini="" onClick={() => setGerer(false)}>OK</button>
          : <>
              {peutEnregistrer && <button type="button" className="vrm-vue-puce is-ajout" data-vue-enregistrer="" aria-label="Enregistrer ces filtres" onClick={() => onEnregistrer && onEnregistrer()}>
                <span aria-hidden="true">+</span><span className="vrm-vue-nom">{liste.length ? 'Enregistrer' : 'Enregistrer ces filtres'}</span></button>}
              {liste.length > 0 && <button type="button" className="vrm-vue-puce is-texte" data-vues-gerer="" onClick={() => setGerer(true)}>Modifier</button>}
            </>}
      </div>
    </div>
  );
}

// ── « Sélectionner » : le bouton qui entre et sort du mode ──────────────────
export function BoutonSelectionner({ actif, onClick, ecran }) {
  return <button type="button" className="vrm-sel-entree" data-selection-entree={ecran} aria-pressed={!!actif} onClick={onClick}>{actif ? 'Terminé' : 'Sélectionner'}</button>;
}

// La case d'une ligne (44 px de cible ; la ligne entière bascule aussi).
export function CaseSelection({ on, onChange, label, cle }) {
  return (
    <label className="vrm-sel-case-hote" data-sel-case={cle} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="vrm-sel-case-x" checked={!!on} onChange={onChange} aria-label={label}/>
      <span className="vrm-sel-rond" aria-hidden="true"/>
    </label>
  );
}

const LIB_GESTE = { imprimer: 'Imprimer', depose: 'Déposé', masquer: 'Masquer' };
// La barre du bas : le nombre coché, puis UN bouton par geste possible (avec le nombre qu'il touche).
export function BarreSelection({ ecran, resultat, onGeste, onVider, occupe = false }) {
  if (!resultat || !resultat.n) return (
    <div className="vrm-sel-serie" data-selection-barre={ecran} data-selection-n="0" role="status">
      <span className="vrm-sel-serie-n">Touche les lignes à choisir.</span>
    </div>
  );
  return (
    <div className="vrm-sel-serie" data-selection-barre={ecran} data-selection-n={resultat.n} role="region" aria-label="Gestes sur la sélection">
      <span className="vrm-sel-serie-n" role="status">{resultat.n} choisi{resultat.n > 1 ? 's' : ''}{resultat.sansGeste ? <small data-selection-sans-geste={resultat.sansGeste}> · {resultat.sansGeste} sans geste possible</small> : null}</span>
      <span className="vrm-sel-serie-gestes">
        {resultat.gestes.map((g, i) => (
          <button key={g.id} type="button" className={'vrm-sel-serie-b' + (i === 0 ? ' is-primaire' : '')} data-selection-geste={g.id} data-selection-geste-n={g.n} disabled={occupe} onClick={() => onGeste && onGeste(g)}>
            {LIB_GESTE[g.id] || g.id} · {g.n}
          </button>
        ))}
        <button type="button" className="vrm-sel-serie-b is-texte" data-selection-vider="" onClick={onVider}>Tout décocher</button>
      </span>
    </div>
  );
}

// ── La fiche À CÔTÉ de la liste (ordinateur, ≥ 1200 px) ──────────────────────
// Un portail ancré à droite ; la liste se pousse à gauche (html[data-panneau-fiche]),
// rien ne la recouvre. Fermer : la croix, Échap, ou le retour (l'écran passe `retour`).
export function PanneauFiche({ ouvert, titre, sur = '', onFermer, children, ecran, retour = null }) {
  const fermer = React.useRef(null);
  const id = React.useId();
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const racine = document.documentElement;
    racine.setAttribute('data-panneau-fiche', ecran || '1');
    try { fermer.current && fermer.current.focus({ preventScroll: true }); } catch (_) {}
    return () => { if (racine.getAttribute('data-panneau-fiche') === (ecran || '1')) racine.removeAttribute('data-panneau-fiche'); };
  }, [ouvert, ecran]);
  if (!ouvert) return null;
  return createPortal(
    <div className="vrm-panneau-hote">
      <aside className="vrm-panneau-fiche" data-panneau-fiche={ecran} role="dialog" aria-modal="false" aria-labelledby={id}
        onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target && e.target.matches && e.target.matches('input,textarea,select'))) { e.preventDefault(); onFermer && onFermer(); } }}>
        <header className="vrm-panneau-tete">
          <div className="vrm-panneau-titres">{sur ? <span className="vrm-panneau-sur">{sur}</span> : null}<h2 id={id}>{titre}</h2></div>
          <button ref={fermer} type="button" className="vrm-panneau-fermer" aria-label="Fermer la fiche" data-panneau-fermer="" onClick={onFermer}>×</button>
        </header>
        <div className="vrm-panneau-corps">{children}</div>
        {retour}
      </aside>
    </div>, document.body);
}
