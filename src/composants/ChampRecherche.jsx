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

const voixDisponible = () => typeof window !== 'undefined' && typeof (window.SpeechRecognition || window.webkitSpeechRecognition) === 'function';
const MICRO_REFUSE = { oui: false };   // refusé une fois ⇒ plus de micro de la session

export function ChampRecherche({ valeur = '', onChange, placeholder = 'Rechercher', label, micro = false, voix = 'requete',
  onValider, autoFocus = false, inputRef, className = '', ...rest }) {
  const refLocal = React.useRef(null);
  const ref = inputRef || refLocal;
  const [ecoute, setEcoute] = React.useState(false);
  const [refus, setRefus] = React.useState(MICRO_REFUSE.oui);
  const refRec = React.useRef(null);
  const avecMicro = micro && voixDisponible() && !refus;

  React.useEffect(() => () => { try { refRec.current && refRec.current.abort(); } catch (_) {} }, []);

  const dicter = () => {
    if (ecoute) { try { refRec.current && refRec.current.stop(); } catch (_) {} return; }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const t = e && e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
        if (!t) return;
        const texte = voix === 'brut' ? String(t).trim() : requeteDeLaVoix(t).requete;
        if (onChange) onChange(texte);
      };
      rec.onerror = (e) => { setEcoute(false); if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) { MICRO_REFUSE.oui = true; setRefus(true); } };
      rec.onend = () => { setEcoute(false); refRec.current = null; };
      refRec.current = rec; setEcoute(true); rec.start();
    } catch (_) { setEcoute(false); refRec.current = null; }
  };
  const effacer = () => {
    if (onChange) onChange('');
    try { ref.current && ref.current.focus(); } catch (_) {}
  };
  const nom = label || placeholder;
  return (
    <div className={`vrm-champ-recherche${className ? ' ' + className : ''}`} data-champ-recherche="" data-champ-recherche-plein={valeur ? '1' : '0'} {...rest}>
      <span className="vrm-champ-recherche-loupe"><IconeComposant nom="search" taille={17}/></span>
      <input ref={ref} type="search" className="vrm-champ-recherche-saisie" value={valeur}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onValider) { e.preventDefault(); onValider(valeur); } if (e.key === 'Escape' && valeur) { e.preventDefault(); e.stopPropagation(); effacer(); } }}
        placeholder={placeholder} aria-label={nom} autoFocus={autoFocus}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"/>
      {valeur ? (
        <button type="button" className="vrm-champ-recherche-bouton vrm-champ-recherche-effacer" data-champ-recherche-effacer="" aria-label="Effacer la recherche" onClick={effacer}>
          <span className="vrm-champ-recherche-rond"><IconeComposant nom="close" taille={11} trait={2.6}/></span>
        </button>
      ) : null}
      {avecMicro ? (
        <button type="button" className="vrm-champ-recherche-bouton vrm-champ-recherche-micro" data-champ-recherche-micro="" data-micro-ecoute={ecoute ? '1' : '0'}
          aria-label="Dicter la recherche" aria-pressed={ecoute} title={ecoute ? 'À l’écoute… parle, puis touche pour arrêter' : 'Dicter'} onClick={dicter}>
          <IconeComposant nom="mic" taille={18}/>
        </button>
      ) : null}
    </div>
  );
}

export default ChampRecherche;
