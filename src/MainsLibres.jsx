// ════════════════════════════════════════════════════════════════════════════
//  MAINS LIBRES (14 nov., proposition 100) — le bouton et sa ligne, dans « Préparer
//  mes colis ». Les règles : src/mainsLibres.js (commandes fermées, reconnaissance du
//  NAVIGATEUR seulement). `onCommande(c)` : l'écran fait le geste ; il rend false
//  quand il n'y a rien à faire (« imprimer » sans bordereau) — c'est dit.
//  Chaque commande reconnue est CONFIRMÉE à l'écran (role="status") ; « fait » passe
//  par le geste de l'écran (« Colis fait » différé 5 s, « Annuler » visible).
//  Sans reconnaissance dans ce navigateur : le bouton dit pourquoi une fois, puis
//  disparaît (mémoire de l'appareil, `vrm_mains_libres_dit`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { langueCourante } from './i18n/index.js';
import { ecouterCommandes, etatMainsLibres } from './mainsLibres.js';
import './styles-colis-plus.css';

const CLE_DIT = 'vrm_mains_libres_dit';
const dejaDit = () => { try { return localStorage.getItem(CLE_DIT) === '1'; } catch (_) { return false; } };
const noterDit = () => { try { localStorage.setItem(CLE_DIT, '1'); } catch (_) {} };

export function MainsLibres({ onCommande }) {
  const etat0 = etatMainsLibres();
  const [absentDit, setAbsentDit] = React.useState(() => etat0 !== 'pret' && dejaDit());
  const [actif, setActif] = React.useState(false);
  const [ligne, setLigne] = React.useState({ texte: '', cmd: false });
  const ecoute = React.useRef(null);
  const ref = React.useRef(onCommande); ref.current = onCommande;
  React.useEffect(() => () => { if (ecoute.current) ecoute.current.arreter(); }, []);
  React.useEffect(() => {
    if (etat0 === 'pret' || absentDit) return undefined;
    const t = setTimeout(() => { noterDit(); setAbsentDit(true); }, 8000);
    return () => clearTimeout(t);
  }, [etat0, absentDit]);
  if (etat0 !== 'pret' && absentDit) return null;
  if (etat0 !== 'pret') {
    return <div className="vrm-cp-voix" data-mains-libres="absent">
      <p className="vrm-cp-voix-l" role="status" data-mains-libres-pourquoi="">{tr(etat0 === 'refuse' ? 'cp.voix.refus' : 'cp.voix.absent')}</p>
    </div>;
  }
  const arreter = () => { if (ecoute.current) ecoute.current.arreter(); ecoute.current = null; setActif(false); };
  const demarrer = () => {
    const e = ecouterCommandes({
      langue: langueCourante(),
      onEntendu: (texte, c) => {
        if (!c) { setLigne({ texte: tr('cp.voix.pasCompris', { texte: texte.slice(0, 40) }), cmd: false }); return; }
        if (c === 'stop') { setLigne({ texte: tr('cp.voix.stop'), cmd: true }); return; }
        let fait = true; try { fait = ref.current(c) !== false; } catch (_) { fait = false; }
        setLigne({ texte: fait ? tr('cp.voix.' + c) : tr('cp.voix.rien', { texte: texte.slice(0, 40) }), cmd: fait, c });
      },
      onErreur: (code) => { setLigne({ texte: tr(code === 'refus' ? 'cp.voix.refus' : 'cp.voix.erreur'), cmd: false }); },
      onFin: () => { ecoute.current = null; setActif(false); },
    });
    if (!e) { setLigne({ texte: tr('cp.voix.erreur'), cmd: false }); return; }
    ecoute.current = e; setActif(true); setLigne({ texte: tr('cp.voix.ecoute'), cmd: false });
  };
  return (
    <div className="vrm-cp-voix" data-mains-libres={actif ? 'ecoute' : 'pret'}>
      <button type="button" className="vrm-cp-voix-b" aria-pressed={actif} data-mains-libres-bouton="" onClick={() => (actif ? arreter() : demarrer())}>
        <span className="vrm-cp-voix-point" aria-hidden="true"/>{actif ? tr('cp.voix.arreter') : tr('cp.voix.bouton')}
      </button>
      <details><summary>?</summary>{tr('cp.voix.pourquoi')}</details>
      {ligne.texte ? <p className={'vrm-cp-voix-l' + (ligne.cmd ? ' is-cmd' : '')} role="status" aria-live="polite" data-mains-libres-ligne={ligne.c || ''}>{ligne.texte}</p> : null}
    </div>
  );
}
export default MainsLibres;
