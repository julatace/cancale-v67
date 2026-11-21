// ── src/aujourdhui/StatsBranche.jsx — Statistiques · Pilotage et Finances, chargé à la demande (21 nov., lot journee-stats) ──
// L'app (src/App.jsx `StatsPilotageApp`) passe la question au propriétaire (`valeurSel` = `valeurChiffre` sur les sources de
// la carte des chiffres), les ventes de la coque et ses outils de lecture ; ce morceau lit le journal et le relevé par les
// MÊMES lectures qu'Aujourd'hui (src/aujourdhui/lectures.js) et range le tout par `statsFenetre` (src/aujourdhui/pilotage.js).
// Aucune règle ici. Le segment et la fenêtre choisis sont gardés sur cet appareil (`vrm_stats_seg`, `vrm_stats_fenetre`).
import React from 'react';
import StatsPilotage from '../natif/ecrans/StatsPilotage.jsx';
import { poserIcone, iconePosee } from '../natif/index.js';
import { statsFenetre, FENETRES, SEGMENTS_STATS, fenetre } from './pilotage.js';
import { statsTransporteurs, CLE_PUB_TRANSP, statsNonRetires, CLE_PUB_NON_RETIRES } from '../statsTransporteurs.js';
import { useLectures, lignesReleve } from './lectures.js';
import { delaisPar, margesPar } from '../statsVentes.js';
import { raisonCourte } from '../design/carteChiffres.js';

const SEL_TOUT = { site: 'toutes', compte: null, periode: null };
const lire = (k, ok, d) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch (_) { return d; } };
// La publication des colis par transporteur (src/App.jsx, l'écran Ventes / Achats) : sur cet appareil, de CE compte.
// Absente ⇒ null (« ouvre Ventes »), jamais une liste vide.
const lirePubTransp = (partie, owner) => { try { const v = JSON.parse(localStorage.getItem(CLE_PUB_TRANSP + '_' + partie) || 'null'); return v && Array.isArray(v.L) && owner && v.owner === owner ? v.L : null; } catch (_) { return null; } };
// (21 nov., lot relier-retires) Les colis non retirés : TOUS ses achats lus, publiés par l'écran Achats (null = pas su).
const lirePubNonRetires = (owner) => { try { const v = JSON.parse(localStorage.getItem(CLE_PUB_NON_RETIRES) || 'null'); return v && Array.isArray(v.L) && owner && v.owner === owner ? v.L : null; } catch (_) { return null; } };
const garder = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* rien */ } };

export default function StatsBranche({ valeurSel, live, outils, montant, Icon, onNav = null, onDorment = null, automatisations = null, onAutomatisations = null }) {
  if (Icon && !iconePosee()) poserIcone(Icon);
  const [seg, setSeg] = React.useState(() => lire('vrm_stats_seg', SEGMENTS_STATS, 'pilotage'));
  const [f, setF] = React.useState(() => lire('vrm_stats_fenetre', FENETRES, '30'));
  const L = useLectures(outils, { avecCapte: false });
  const owner = outils && typeof outils.uid === 'function' ? outils.uid() : null;
  const [pubT, setPubT] = React.useState(() => ({ ventes: lirePubTransp('ventes', owner), achats: lirePubTransp('achats', owner), nonRetires: lirePubNonRetires(owner) }));
  React.useEffect(() => {
    const relire = () => setPubT({ ventes: lirePubTransp('ventes', owner), achats: lirePubTransp('achats', owner), nonRetires: lirePubNonRetires(owner) });
    relire(); window.addEventListener('vrm:stats-transporteurs', relire); window.addEventListener('storage', relire);
    return () => { window.removeEventListener('vrm:stats-transporteurs', relire); window.removeEventListener('storage', relire); };
  }, [owner]);
  const T = React.useMemo(() => { try { const F = fenetre(f); return statsTransporteurs({ ventes: pubT.ventes, achats: pubT.achats, de: F.de, a: F.a }); } catch (_) { return null; } }, [f, pubT]);
  const NR = React.useMemo(() => { try { const F = fenetre(f); return pubT.nonRetires ? { periode: statsNonRetires({ achats: pubT.nonRetires, de: F.de, a: F.a }), tout: statsNonRetires({ achats: pubT.nonRetires }) } : null; } catch (_) { return null; } }, [f, pubT]);
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
  return <StatsPilotage M={M} etats={etats} montant={montant} Icon={Icon} onNav={onNav} onDorment={onDorment} automatisations={automatisations} onAutomatisations={onAutomatisations}
    transporteurs={T} etatsTransp={{ ventes: pubT.ventes ? 'lu' : 'passu', achats: pubT.achats ? 'lu' : 'passu', nonRetires: pubT.nonRetires ? 'lu' : 'passu' }} nonRetires={NR}
    seg={seg} setSeg={(x) => { setSeg(x); garder('vrm_stats_seg', x); }} f={f} setF={(x) => { setF(x); garder('vrm_stats_fenetre', x); }}
    onJournal={onNav ? () => onNav('settings') : null}/>;
}
