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
import { PlanDuMatin } from './PlanDorment.jsx';
import { ouvrirPanneau } from '../ouvrirPanneau.js';
import { ACTIONS_EXTENSION, PANNEAU_DE_SELECTION } from '../actionsExtension.js';
import { tr } from '../i18n/index.js';

// (24 nov., règle de Julien « agir seulement si l'extension est connectée sur ce compte ») LA PORTE commune
// (src/agir/porte.js, lot agir-si-connecte) est prise si elle est dans l'arbre ; sans elle, chaque geste passe par le
// panneau de l'extension, qui n'agit qu'au nom du compte de SON onglet (`garde`) et dans ses plafonds.
const PORTE = Object.values(import.meta.glob('../agir/porte.js', { eager: true }))[0] || null;
const usePorte = PORTE && typeof PORTE.useFaitsAgir === 'function' ? PORTE.useFaitsAgir : () => null;
// Le geste de la porte pour chaque action Vinted du plan (les noms de GESTES_AGIR).
export const GESTE_PORTE = Object.freeze({ baisser: 'baisser', favoris: 'favoris', republier: 'republier', prix: 'prix' });
export function verdictPlan(l, porte = PORTE) {
  const g = l && l.action ? GESTE_PORTE[l.action.k] : null;
  if (!g || !porte || typeof porte.agirMaintenant !== 'function') return { ok: true };
  const v = porte.agirMaintenant('vinted', String(l.uid || ''), g, '');
  return v && v.ok ? { ok: true } : { ok: false, texte: v && v.cle ? tr(v.cle, v.vars || {}) : '' };
}
// LE GESTE d'une ligne du plan : le chemin gardé EXISTANT, le même que la liste « Qui dorment » d'Annonces
// (`allerDormante`) — panneau de l'extension sur CETTE annonce (son identifiant), ou l'écran eBay de VRM. Rien d'autre.
export function agirPlan(l, { onEbay = null, ouvrir = ouvrirPanneau } = {}) {
  const a = (l && l.action) || {}, ids = [String(l.id)];
  const panneau = (cle) => { const x = ACTIONS_EXTENSION[cle]; return ouvrir({ site: 'vinted', page: x.page, ids, action: x.action }); };
  switch (a.k) {
    case 'baisser': return panneau(PANNEAU_DE_SELECTION.baisser);
    case 'prix': return panneau(PANNEAU_DE_SELECTION.modifier);
    case 'republier': return panneau(PANNEAU_DE_SELECTION.recreer);
    case 'favoris': return panneau('favoris');
    case 'lbc': return ouvrir({ site: 'leboncoin', page: 'publier', ids, action: 'publier' });
    case 'vestiaire': return ouvrir({ site: 'vestiaire', page: 'publier', ids, action: 'publier' });
    case 'ebay': return onEbay ? onEbay(String(l.id)) : undefined;
    default: return undefined;
  }
}
import './conseiller.css';

export default function ConseillerBranche({ valeurSel, live, outils, onNav, onSaisirPrix = null, onEbay = null, Icon = null, Photo = null }) {
  usePorte();   // re-rendu quand la porte change (connexion, version)
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
  // (24 nov.) Le plan du matin remplace le compte « N paires dorment » (une notion, un endroit) quand il a des lignes.
  const avecPlan = !!(S && S.plan && Array.isArray(S.plan.lignes) && S.plan.lignes.length);
  const liste = React.useMemo(() => (S ? conseilsDe(S, maintenant).filter((c) => !(avecPlan && c.id === 'dorment')) : []), [S, avecPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  const etat = L.releve === undefined && L.extras === undefined ? 'encours' : 'lu';
  const geste = (g) => faireGeste(g, { onNav, vue: outils && outils.vue, onSaisirPrix,
    onDorment: outils && outils.vue ? () => { outils.vue('dorment'); if (onNav) onNav('cat_annonces'); } : null });
  const plan = S && S.plan ? <PlanDuMatin plan={S.plan} onAgir={(l) => agirPlan(l, { onEbay })} verdict={verdictPlan} Icon={Icon} Photo={Photo}/> : null;
  return <EcranConseiller liste={liste} etat={etat} onGeste={geste} Icon={Icon} Photo={Photo} plan={plan}
    demande={<DemandeVRM sources={S} conseils={liste} outils={outils} onGeste={geste} Icon={Icon}/>}/>;
}
