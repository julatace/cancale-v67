// ═══════════════════════════════════════════════════════════════════════════
// « TOUT VA BIEN ? » EN TÊTE DES PARAMÈTRES — quand quelque chose ne va pas (15 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Une rangée ambre, UN geste (« Voir » ⇒ le panneau « Tout va bien ? »), et rien du
// tout quand tout va bien OU quand on ne sait pas (« pas su » n'est ni une alerte ni
// un feu vert, §5). Les sources sont celles qui existent déjà, jamais recalculées :
//   · un compte pas relu (une panne de capture) : `useEtatCapture` (src/ToutVaBien.jsx,
//     la règle `api/_lib/garde-capture.js`, la même que le cron qui notifie) ;
//   · l'extension d'un appareil actif en retard : `etatVersion` (même fichier) ;
//   · la base injoignable : l'état de la synchro (`onSyncChange`, celui du nuage).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useEtatCapture } from '../ToutVaBien.jsx';
import { etatVersion, ACTIF_MS } from '../../api/_lib/garde-capture.js';
import { EXT_ATTENDUE, onSyncChange, _syncInfo } from '../App.jsx';
import { tr } from '../i18n/index.js';

// La règle, sans React (le banc et l'audit la jugent) : la liste des choses à regarder.
export function chosesARegarder({ etat, base, maintenant = Date.now(), attendue = EXT_ATTENDUE }) {
  const out = [];
  if (base === 'error' || base === 'refus') out.push({ id: 'base' });
  if (etat && Array.isArray(etat.pannes) && etat.pannes.length) out.push({ id: 'comptes', n: etat.pannes.length });
  if (etat && Array.isArray(etat.appareils)) {
    const vieux = etat.appareils.filter((a) => a && maintenant - (a.at || 0) <= ACTIF_MS && etatVersion(a, attendue) === 'ancienne');
    if (vieux.length) out.push({ id: 'extension', n: vieux.length });
  }
  return out;
}

const texte = (c) => c.id === 'base' ? tr('parametres.alerte.base') : c.id === 'comptes' ? tr('parametres.alerte.comptes', { n: c.n }) : tr('parametres.alerte.extension', { n: c.n });

export function AlerteParametres({ onVoir }) {
  const { etat } = useEtatCapture();
  const [base, setBase] = React.useState(() => (_syncInfo && _syncInfo.etat) || '');
  React.useEffect(() => onSyncChange((st) => setBase(String(st || ''))), []);
  const choses = chosesARegarder({ etat, base });
  if (!choses.length) return null;
  return (
    <div className="vrm-set-liste vrm-pm-alerte-liste" role="status">
    <button type="button" className="vrm-set-ligne vrm-pm-alerte" data-reglages-alerte={choses.map((c) => c.id).join(' ')} onClick={onVoir}>
      <span className="vrm-pm-alerte-point vg-pm-alerte-ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z"/></svg></span>
      <span className="vrm-set-lib">
        <b>{tr('parametres.alerte.titre')}</b>
        <small className="vrm-set-desc">{(() => { const t = choses.map(texte).join(' · '); return t.charAt(0).toLocaleUpperCase() + t.slice(1); })()}</small>
      </span>
      <span className="vrm-pm-alerte-geste"><span className="vg-sr">{tr('parametres.alerte.voir')}</span><svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 6 6-6 6"/></svg></span>
    </button>
    </div>
  );
}
