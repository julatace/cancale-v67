// ── src/conseiller/Branche.jsx — l'écran « Conseiller », chargé à la demande (23 nov.) ──
// L'app (src/App.jsx `ConseillerApp`) passe la question au propriétaire (`valeurSel`), les ventes de la coque et ses
// outils — les MÊMES que la carte d'Aujourd'hui. Les sources : src/conseiller/sources.js (une fonction pour les deux).
import React from 'react';
import { useLectures } from '../aujourdhui/lectures.js';
import { sourcesConseiller } from './sources.js';
import { conseils as conseilsDe } from './regles.js';
import { faireGeste } from './gestes.js';
import { EVT_PUB_CONSEILLER } from './publications.js';
import { EVT_OSR } from '../offresSansReponse.js';
import { EcranConseiller } from './Conseiller.jsx';
import DemandeVRM from './DemandeVRM.jsx';
import './conseiller.css';

export default function ConseillerBranche({ valeurSel, live, outils, onNav, onSaisirPrix = null, Icon = null }) {
  const L = useLectures(outils, { avecCapte: false });
  const [tick, publie] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const f = () => publie();
    window.addEventListener(EVT_PUB_CONSEILLER, f); window.addEventListener(EVT_OSR, f); window.addEventListener('vrm:save', f);
    return () => { window.removeEventListener(EVT_PUB_CONSEILLER, f); window.removeEventListener(EVT_OSR, f); window.removeEventListener('vrm:save', f); };
  }, []);
  const maintenant = Date.now();
  const S = React.useMemo(() => { try { return sourcesConseiller({ o: outils, valeurSel, live, L, maintenant }); } catch (_) { return null; } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [outils, valeurSel, live, L.releve, L.extras, tick]);
  const liste = React.useMemo(() => (S ? conseilsDe(S, maintenant) : []), [S]); // eslint-disable-line react-hooks/exhaustive-deps
  const etat = L.releve === undefined && L.extras === undefined ? 'encours' : 'lu';
  const geste = (g) => faireGeste(g, { onNav, vue: outils && outils.vue, onSaisirPrix,
    onDorment: outils && outils.vue ? () => { outils.vue('dorment'); if (onNav) onNav('cat_annonces'); } : null });
  return <EcranConseiller liste={liste} etat={etat} onGeste={geste} Icon={Icon}
    demande={<DemandeVRM sources={S} conseils={liste} outils={outils} onGeste={geste} Icon={Icon}/>}/>;
}
