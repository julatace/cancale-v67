// ═══════════════════════════════════════════════════════════════════════════
// LE CHAMP DE RECHERCHE — un seul dessin (5 nov., revue de cohérence 1.8)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : cinq dessins (bordure grise carrée, pilule, champ nu dans
// la barre, champ teinté, champ dans un menu), deux tailles de loupe, la croix
// d'effacement du navigateur ici et pas là. Un seul dessin désormais : le champ
// teinté d'iOS (remplissage gris, aucune bordure), loupe à gauche, la croix
// ronde quand il y a du texte, et le micro intégré en option.
//   · cible 44 px au doigt (36 px à la souris) ; texte 17 px au doigt — iOS
//     zoome la page sur un champ sous 16 px ;
//   · le micro n'apparaît QUE si le navigateur sait reconnaître la voix (Web
//     Speech, `fr-FR`, sans clé ni serveur : §2.9) et disparaît s'il est refusé —
//     jamais un bouton mort ; ce qui est reconnu passe par `requeteDeLaVoix`
//     (« numéro 124 » ⇒ « 124 », « bé 125 » ⇒ « B125 ») sauf `voix="brut"` ;
//   · « Effacer » vide le champ et y rend le focus.
// API (docs/passation/2026-11-05-chantier-b.md) :
//   <ChampRecherche valeur onChange placeholder? label? micro? voix? onValider? autoFocus? inputRef? className? {...data-*}>
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { IconeComposant } from './icones.jsx';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import { voixDisponible, VOIX, ecouter, ecouteEnCours, annulerVoix, effacerErreurVoix, PHRASES_VOIX } from '../dicteeNavigateur.js';
import { useEtatVoix } from './voix.jsx';

// (11 nov., parler à la loupe) Le moteur est commun (src/dicteeNavigateur.js) : la
// transcription s'affiche EN DIRECT dans le champ, puis le texte final passe par
// `requeteDeLaVoix` ; une erreur dit quoi faire (micro refusé : la phrase reste
// sous le champ, le micro disparaît — jamais un bouton mort).
let N_CANAL = 0;

export function ChampRecherche({ valeur = '', onChange, placeholder = 'Rechercher', label, micro = false, voix = 'requete',
  onValider, autoFocus = false, inputRef, className = '', ...rest }) {
  const refLocal = React.useRef(null);
  const ref = inputRef || refLocal;
  const canalRef = React.useRef(null);
  if (!canalRef.current) canalRef.current = 'champ-' + (++N_CANAL);
  const canal = canalRef.current;
  const ev = useEtatVoix(canal);
  const ecoute = ev.ecoute;
  const composition = React.useRef(false);
  const avecMicro = micro && voixDisponible() && !VOIX.refus;
  const phrase = micro && voixDisponible() ? (ev.erreur || null) : null;

  const interrompre = () => { if (ecouteEnCours(canal)) annulerVoix(canal); };
  React.useEffect(() => () => { annulerVoix(canal); }, [canal]);

  const dicter = () => {
    ecouter({ canal,
      onDirect: (t, fini) => { if (!fini && onChange) onChange(t); },
      onFinal: (t) => { const texte = voix === 'brut' ? String(t).trim() : requeteDeLaVoix(t).requete; if (onChange) onChange(texte); },
    });
  };
  const effacer = () => {
    interrompre();
    if (onChange) onChange('');
    try { ref.current && ref.current.focus(); } catch (_) {}
  };
  const nom = label || placeholder;
  return (
    <div className={`vrm-champ-recherche${className ? ' ' + className : ''}`} data-champ-recherche="" data-champ-recherche-plein={valeur ? '1' : '0'} data-voix-ecoute={ecoute ? '1' : '0'} {...rest}>
      <span className="vrm-champ-recherche-loupe"><IconeComposant nom="search" taille={17}/></span>
      <input ref={ref} type="search" className="vrm-champ-recherche-saisie" value={valeur}
        onChange={(e) => { interrompre();effacerErreurVoix(canal);onChange && onChange(e.target.value); }}
        onCompositionStart={()=>{composition.current=true;interrompre();}} onCompositionEnd={()=>{composition.current=false;}}
        onKeyDown={(e) => { if(composition.current||e.nativeEvent.isComposing||e.keyCode===229){if(e.key==='Enter'||e.key==='Escape')e.stopPropagation();return;} if (e.key === 'Enter' && onValider) { e.preventDefault(); onValider(valeur); } if (e.key === 'Escape' && (valeur||ecouteEnCours(canal))) { e.preventDefault(); e.stopPropagation(); effacer(); } }}
        placeholder={placeholder} aria-label={nom} autoFocus={autoFocus}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"/>
      {valeur ? (
        <button type="button" className="vrm-champ-recherche-bouton vrm-champ-recherche-effacer" data-champ-recherche-effacer="" aria-label="Effacer la recherche" onClick={effacer}>
          <span className="vrm-champ-recherche-rond"><IconeComposant nom="close" taille={11} trait={2.6}/></span>
        </button>
      ) : null}
      {avecMicro ? (
        <button type="button" className="vrm-champ-recherche-bouton vrm-champ-recherche-micro" data-champ-recherche-micro="" data-micro-ecoute={ecoute ? '1' : '0'}
          aria-label={ecoute?"Arrêter la dictée":"Dicter la recherche"} aria-pressed={ecoute} title={ecoute ? 'À l’écoute… parle, puis touche pour arrêter' : 'Dicter'} onClick={dicter}>
          <IconeComposant nom="mic" taille={18}/>
        </button>
      ) : null}
      {phrase ? <span className="vrm-champ-recherche-voix" data-voix-erreur={phrase} role="status"
        style={{position:'absolute',left:0,top:'calc(100% + 4px)',width:'max(100%, 260px)',maxWidth:'calc(100vw - 32px)',boxSizing:'border-box',zIndex:5,fontSize:12,lineHeight:1.4,padding:'6px 10px',borderRadius:10,background:'var(--vrm-surface, #fff)',color:'var(--vrm-ink, #1D1D1F)',border:'1px solid var(--vrm-line, rgba(0,0,0,.1))',boxShadow:'0 2px 10px rgba(0,0,0,.12)'}}
        onClick={()=>effacerErreurVoix(canal)}>{PHRASES_VOIX[phrase] || PHRASES_VOIX.autre}</span> : null}
    </div>
  );
}

export default ChampRecherche;
