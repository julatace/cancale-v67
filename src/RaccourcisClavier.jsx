// ═══════════════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER — l'écoute et la feuille « ? » (10 nov., lot P)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (quelles touches, quand elles comptent) : src/raccourcisClavier.js.
// Ici : une écoute sur la fenêtre, qui ne fait que NAVIGUER (`vrm:aller`, le
// chemin des liens `?tab=` d'App.jsx : la même liste blanche) ou ouvrir la
// liste des raccourcis dans la feuille unique (`Feuille` = SheetShell de l'app :
// portail, focus gardé dedans, Échap, retour).
import React from 'react';
import { ALLER, SEULES, toucheEcoutee, lireTouche } from './raccourcisClavier.js';
import './raccourcis-clavier.css';

export const EVT_AIDE_CLAVIER = 'vrm:raccourcis-clavier';
const modaleOuverte = () => { try { return !!document.querySelector('[aria-modal="true"]'); } catch (_) { return false; } };

export default function RaccourcisClavier({ Feuille }) {
  const [ouvert, setOuvert] = React.useState(false);
  const etat = React.useRef({ g: 0 });
  React.useEffect(() => {
    const k = (e) => {
      if (!toucheEcoutee(e, modaleOuverte())) { etat.current = { g: 0 }; return; }
      const r = lireTouche(etat.current, e.key, Date.now());
      etat.current = r.etat;
      if (!r.pris) return;
      e.preventDefault();
      const a = r.action; if (!a) return;
      if (a.sorte === 'aller' && a.lien) { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: a.lien })); } catch (_) {} return; }
      if (a.sorte === 'ouvrir' && a.quoi === 'aide') setOuvert(true);
    };
    const aide = () => setOuvert(true);
    window.addEventListener('keydown', k);
    window.addEventListener(EVT_AIDE_CLAVIER, aide);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener(EVT_AIDE_CLAVIER, aide); };
  }, []);
  if (!ouvert || !Feuille) return null;
  const Touche = ({ t }) => <kbd className="vrm-kbd">{t}</kbd>;
  return (
    <Feuille onClose={() => setOuvert(false)} titre="Raccourcis clavier" sousTitre="Jamais pendant que tu tapes dans un champ." maxWidth={460} z={10400}>
      <div className="vrm-rc" data-raccourcis-clavier="">
        <section aria-labelledby="vrm-rc-aller">
          <h3 className="vrm-rc-titre" id="vrm-rc-aller">Aller à</h3>
          <ul className="vrm-rc-liste">
            {ALLER.map((x) => (
              <li key={x.touche} className="vrm-rc-ligne" data-raccourci={'g' + x.touche}>
                <span className="vrm-rc-nom">{x.nom}</span>
                <span className="vrm-rc-touches" aria-label={`g puis ${x.touche.toUpperCase()}`}><Touche t="g"/><span className="vrm-rc-puis" aria-hidden="true">puis</span><Touche t={x.touche.toUpperCase()}/></span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="vrm-rc-partout">
          <h3 className="vrm-rc-titre" id="vrm-rc-partout">Partout</h3>
          <ul className="vrm-rc-liste">
            {SEULES.map((x) => (
              <li key={x.touche} className="vrm-rc-ligne" data-raccourci={x.touche}>
                <span className="vrm-rc-nom">{x.nom}</span>
                <span className="vrm-rc-touches"><Touche t={x.touche === 'n' ? 'N' : x.touche}/></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Feuille>
  );
}
