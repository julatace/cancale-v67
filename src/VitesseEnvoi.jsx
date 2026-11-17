// ════════════════════════════════════════════════════════════════════════════
//  « VITESSE D'ENVOI » (10 nov., lot BM) — UNE carte de Statistiques, isolée :
//  elle LIT la publication de l'écran qui calcule les départs (`vrm_vitesse_envoi`,
//  src/vitesseEnvoi.js) ; elle ne redécide aucun départ. Par compte, sur 30 jours :
//  la médiane en grand, une barre neutre, « sur N colis » et le manque NOMMÉ.
//  `LigneVitesse` : la même lecture en une ligne (Ma semaine).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { vitesseParCompte, ralentissements, texteDuree, texteCouvertureVitesse, lireVitesse, CLE_VITESSE, EVT_VITESSE, JOURS_VITESSE } from './vitesseEnvoi.js';
import { tr } from './i18n/index.js';
import './styles-vitesse-avis.css';

export function useVitesse(owner) {
  const [v, setV] = useState(() => lireVitesse(owner));
  useEffect(() => {
    const relire = () => setV(lireVitesse(owner));
    relire();
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_VITESSE) relire(); };
    window.addEventListener(EVT_VITESSE, relire);
    window.addEventListener('storage', surStockage);
    return () => { window.removeEventListener(EVT_VITESSE, relire); window.removeEventListener('storage', surStockage); };
  }, [owner]);
  return v;
}

export default function VitesseEnvoi({ owner = '', maintenant = null }) {
  const pub = useVitesse(owner);
  const V = useMemo(() => (pub ? vitesseParCompte(pub.lignes, { maintenant: maintenant || Date.now() }) : null), [pub, maintenant]);
  // (16 nov., lot aide-decision) Un compte qui ralentit NETTEMENT (30 j contre les 30 d'avant) : dit doucement.
  const Rl = useMemo(() => (pub ? ralentissements(pub.lignes, { maintenant: maintenant || Date.now() }) : null), [pub, maintenant]);
  const tete = <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">Vitesse d’envoi</h2><span className="vrm-sv-note">vente → dépôt · {JOURS_VITESSE} jours</span></div>;
  let corps;
  if (!V) corps = <p className="vrm-ve-vide" data-ve-etat="passu">— · ouvre Colis ou Ventes pour la calculer</p>;
  else if (!V.comptes.length) corps = <p className="vrm-ve-vide" data-ve-etat="lu" data-ve-n="0">Aucun colis parti sur {JOURS_VITESSE} jours.</p>;
  else {
    const max = Math.max(0, ...V.comptes.map((c) => c.mediane || 0));
    corps = (
      <div className="vrm-ve" data-ve-etat="lu" data-ve-n={V.tout.n} data-ve-mediane={V.tout.mediane == null ? '' : V.tout.mediane} data-ve-sans-date={V.tout.sansDate} data-ve-partiel={pub.partiel ? '1' : undefined}>
        {V.comptes.length > 1 ? (
          <div className="vrm-ve-tout"><b className="vrm-display" data-ve-tout={V.tout.mediane == null ? '' : V.tout.mediane}>{texteDuree(V.tout.mediane)}</b><span>médiane · {texteCouvertureVitesse(V.tout)}</span></div>
        ) : null}
        <ol className="vrm-ve-liste">
          {V.comptes.map((c) => (
            <li key={c.cle || '?'} className="vrm-ve-ligne" data-ve-compte={c.cle} data-ve-mediane={c.mediane == null ? '' : c.mediane} data-ve-n={c.n} data-ve-sans-date={c.sansDate}
              title={c.moyenne != null ? `moyenne ${texteDuree(c.moyenne)}` : undefined}>
              <span className="vrm-ve-nom">{c.nom || 'Compte'}</span>
              <span className="vrm-ve-val">{texteDuree(c.mediane)}</span>
              <span className="vrm-ve-piste" aria-hidden="true"><span style={{ width: `${c.mediane != null && max > 0 ? Math.max(3, (c.mediane / max) * 100) : 0}%` }}/></span>
              <span className="vrm-ve-sur">{texteCouvertureVitesse(c)}{c.moyenne != null ? <> · <span data-ve-moyenne={c.moyenne}>{tr('ad.envoi.moyenne', { duree: texteDuree(c.moyenne) })}</span></> : null}</span>
            </li>
          ))}
        </ol>
        {Rl && Rl.length ? Rl.map((r) => (
          <p key={r.cle || '?'} className="vrm-ve-ralenti" role="status" data-ve-ralenti={r.cle} data-ve-avant={r.avant} data-ve-maintenant={r.maintenant}>
            {tr('ad.envoi.ralenti', { nom: r.nom || tr('ad.envoi.compte'), maintenant: texteDuree(r.maintenant), avant: texteDuree(r.avant) })}
          </p>
        )) : null}
        {pub.partiel ? <p className="vrm-ve-note" data-ve-manque="emails">E-mails des transporteurs pas lus : certains dépôts n’ont pas de date.</p> : null}
      </div>
    );
  }
  return <section className="vrm-sv-carte vrm-ve-carte" data-stats-carte="vitesse-envoi">{tete}{corps}</section>;
}

// Ma semaine : une ligne, la même lecture (rien de recalculé ailleurs).
export function LigneVitesse({ owner = '' }) {
  const pub = useVitesse(owner);
  const V = useMemo(() => (pub ? vitesseParCompte(pub.lignes) : null), [pub]);
  if (!V || !V.tout.n) return null;
  // Le widget de Ma semaine (classes de src/styles-ma-semaine.css) : rien de dessiné à part.
  return (
    <section className="vrm-ms-w is-large" data-ms-chiffre="vitesse" data-ve-semaine={V.tout.mediane}>
      <span className="vrm-ms-l">Vitesse d’envoi</span>
      <b className="vrm-ms-v">{texteDuree(V.tout.mediane)}</b>
      <small className="vrm-ms-sous">médiane sur {JOURS_VITESSE} jours · {texteCouvertureVitesse(V.tout)}</small>
    </section>
  );
}
