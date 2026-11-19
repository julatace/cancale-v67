// ══════════════════════════════════════════════════════════════════════════════
// « TON ADRESSE VRM » dans Paramètres — LE parcours unique (8 nov. ; 10 nov. ; 19 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// (19 nov., lot emails-mail) Un seul parcours dans toute l'app : « Relier ma boîte », accompagné, une étape par
// écran (src/RelierMaBoite.jsx). E-mails → Relier ma boîte le montre en page ; Paramètres → Mes e-mails → Mon
// adresse VRM le montre ICI, dans une feuille. Les réglages de l'adresse (« Adresse active », « Remplacer ») vivent
// DANS le parcours, sur les mêmes gestes de la même route (`email-rattacher?mode=adresse-unique`, POST).
// L'ancien parcours en 1 · 2 · 3 · ✓ (ParcoursAdresseVrm) est retiré : son récit est dans l'historique sécurité
// et docs/passation/2026-11-10-*.md ; sa lecture (`useAdresseVrm`) est passée dans src/RelierMaBoite.jsx.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { SheetShell } from './composants/SheetShell.jsx';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import RelierMaBoite from './RelierMaBoite.jsx';
import { tr } from './i18n/index.js';
import './adresse-reception.css';

const Svg = ({ children, t = 18 }) => <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ARROBASE = <Svg><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></Svg>;


// Paramètres → Mes e-mails → Mon adresse VRM : LE MÊME parcours, dans une feuille.
export function FeuilleAdresseReception({ headers, onFermer, FermeAuRetour, proprio = false, onBoite }) {
  const [etat, setEtat] = useState('lecture');
  return (
    <SheetShell onClose={onFermer} FermeAuRetour={FermeAuRetour} titre={tr('relier.feuille.titre')} maxWidth={560} z={9000} className="vrm-ar-feuille" data-feuille-adresse-reception="" data-etat={etat}>
      <ObservateurEtat onEtat={setEtat}>
        <RelierMaBoite headers={headers} proprio={proprio} onBoite={onBoite ? () => { onFermer && onFermer(); onBoite(); } : undefined}/>
      </ObservateurEtat>
      <div className="vrm-pv-feuille-pied"><button type="button" className="vrm-b vrm-b-secondaire vrm-ar-termine" onClick={onFermer} data-termine="">{tr('relier.feuille.termine')}</button></div>
    </SheetShell>
  );
}
// Recopie l'état du parcours sur la feuille (`data-etat`, lu par les bancs).
function ObservateurEtat({ onEtat, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const n = ref.current && ref.current.querySelector('[data-parcours-adresse]');
    if (!n) return undefined;
    const maj = () => onEtat(n.getAttribute('data-etat') || 'lecture');
    maj();
    const o = new MutationObserver(maj); o.observe(n, { attributes: true, attributeFilter: ['data-etat'] });
    return () => o.disconnect();
  }, [onEtat]);
  return <div ref={ref}>{children}</div>;
}

// L'ancienne entrée (une rangée qui ouvre la feuille), gardée pour qui l'importe.
export default function CarteAdresseReception({ headers, FermeAuRetour, proprio = false, onBoite, titre = '', detail = '' }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <GroupeIos className="vrm-ar-entree" data-adresse-reception-entree="">
        <RangeeIos icone={ARROBASE} titre={titre || tr('relier.adresse.titre')} detail={detail || tr('relier.feuille.detail')} onClick={() => setOuvert(true)} data-ouvrir-adresse-reception=""/>
      </GroupeIos>
      {ouvert ? <FeuilleAdresseReception headers={headers} FermeAuRetour={FermeAuRetour} proprio={proprio} onBoite={onBoite} onFermer={() => setOuvert(false)}/> : null}
    </>
  );
}
