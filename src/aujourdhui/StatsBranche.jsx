// ── src/aujourdhui/StatsBranche.jsx — Statistiques · Pilotage et Finances, chargé à la demande (21 nov., lot journee-stats) ──
// L'app (src/App.jsx `StatsPilotageApp`) passe la question au propriétaire (`valeurSel` = `valeurChiffre` sur les sources de
// la carte des chiffres), les ventes de la coque et ses outils de lecture ; ce morceau lit le journal et le relevé par les
// MÊMES lectures qu'Aujourd'hui (src/aujourdhui/lectures.js) et range le tout par `statsFenetre` (src/aujourdhui/pilotage.js).
// Aucune règle ici. Le segment et la fenêtre choisis sont gardés sur cet appareil (`vrm_stats_seg`, `vrm_stats_fenetre`).
import React from 'react';
import StatsPilotage from '../natif/ecrans/StatsPilotage.jsx';
import { poserIcone, iconePosee } from '../natif/index.js';
import { statsFenetre, FENETRES, SEGMENTS_STATS } from './pilotage.js';
import { useLectures, lignesReleve } from './lectures.js';
import { delaisPar, margesPar } from '../statsVentes.js';
import { raisonCourte } from '../design/carteChiffres.js';

const SEL_TOUT = { site: 'toutes', compte: null, periode: null };
const lire = (k, ok, d) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch (_) { return d; } };
const garder = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* rien */ } };

export default function StatsBranche({ valeurSel, live, outils, montant, Icon, onNav = null, onDorment = null }) {
  if (Icon && !iconePosee()) poserIcone(Icon);
  const [seg, setSeg] = React.useState(() => lire('vrm_stats_seg', SEGMENTS_STATS, 'pilotage'));
  const [f, setF] = React.useState(() => lire('vrm_stats_fenetre', FENETRES, '30'));
  const L = useLectures(outils, { avecCapte: false });
  const lignes = live && Array.isArray(live.venduLignes) ? live.venduLignes : (live && live.venduPasSu ? null : undefined);
  const etats = {
    ventes: lignes === undefined ? 'encours' : lignes ? 'lu' : 'passu',
    journal: L.journal === undefined ? 'encours' : L.journal ? 'lu' : 'passu',
    releve: L.releve === undefined || L.extras === undefined ? 'encours' : L.releve ? 'lu' : 'passu',
  };
  const M = React.useMemo(() => {
    try {
      const v = (id, p = null, sel = SEL_TOUT) => valeurSel(id, p, sel) || {};
      const releve = L.extras === undefined ? undefined : lignesReleve(L.releve, L.extras, outils && outils.enLigne);
      const txn = L.extras && L.extras.txn ? L.extras.txn : null;
      const EL = v('enligne'), Do = v('dorment');
      return statsFenetre({ cle: f, valeur: v, evenements: L.journal === undefined ? null : L.journal, lignes: lignes || null,
        itemDeTx: txn ? (tx) => (txn[tx] && txn[tx].item) || null : null, releve, regles: { delaisPar, margesPar }, raisonCourte,
        enLigne: EL.valeur == null ? null : { valeur: EL.valeur },
        dorment: { valeur: Do.valeur == null ? null : Do.valeur, partiel: !!Do.partiel, raison: Do.valeur == null ? raisonCourte(Do) : '' } });
    } catch (_) { return null; /* pas su ⇒ « — » partout, la boîte reste */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, L.journal, L.extras, L.releve, lignes, valeurSel]);
  return <StatsPilotage M={M} etats={etats} montant={montant} Icon={Icon} onNav={onNav} onDorment={onDorment}
    seg={seg} setSeg={(x) => { setSeg(x); garder('vrm_stats_seg', x); }} f={f} setF={(x) => { setF(x); garder('vrm_stats_fenetre', x); }}
    onJournal={onNav ? () => onNav('settings') : null}/>;
}
