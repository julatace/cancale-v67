// ════════════════════════════════════════════════════════════════════════════
//  « MARGE PAR PLATEFORME » (10 nov., lot I) — UNE carte de Statistiques,
//  isolée, à côté de « D'où viennent mes achats » et « Vitesse d'envoi ». Elle
//  LIT ce que leurs propriétaires ont publié (`liveStats.venduLignes` pour le
//  vendu, le relevé `vrm_stats_ventes` de Ventes pour le bénéfice) et la règle
//  pure `margeParPlateforme` (src/margePlateforme.js) les range par site.
//  Une barre par site (la meilleure médiane à l'accent, seulement si elle est
//  conclue), le manque NOMMÉ ; un site pas lu ⇒ « — » et la raison.
// ════════════════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { margeParPlateforme, texteMarge } from './margePlateforme.js';
import './styles-marge-plateforme.css';

const NOM = { Vinted: 'Vinted', Leboncoin: 'Leboncoin', eBay: 'eBay', Vestiaire: 'Vestiaire Co' };

// liveStats : la coque (vendu) ; releve : les lignes du relevé DÉJÀ bornées à la
// période (null = pas publié) ; de, a : la période ; onSaisirPrix : la porte de saisie.
export default function MargePlateforme({ liveStats, releve = null, de, a, onSaisirPrix = null }) {
  const vendu = !liveStats ? undefined : liveStats.venduPasSu ? null : liveStats.venduLignes;
  const R = useMemo(() => margeParPlateforme({
    vendu, manque: (liveStats && liveStats.venduManque) || [], nonComptees: (liveStats && liveStats.venduNonComptees) || [], releve, de, a,
  }), [vendu, liveStats, releve, de, a]);
  const max = Math.max(0, ...R.plateformes.map((p) => (p.etat === 'lu' && p.mediane > 0 ? p.mediane : 0)));
  const sansAchat = R.plateformes.reduce((s, p) => s + (p.etat === 'lu' ? p.nSansAchat : 0), 0);
  return (
    <section className="vrm-sv-carte vrm-mp-carte" data-stats-carte="marge-plateforme" data-mp-etat={R.etat} data-mp-releve={R.releveLu ? '1' : '0'}>
      <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">Marge par plateforme</h2><span className="vrm-sv-note">bénéfice par paire</span></div>
      <ol className="vrm-mp-liste">
        {R.plateformes.map((p) => {
          const t = texteMarge(p);
          const w = p.etat === 'lu' && p.mediane != null && p.mediane > 0 && max > 0 ? Math.max(3, (p.mediane / max) * 100) : 0;
          return (
            <li key={p.plat} className="vrm-mp-ligne" data-mp-plat={p.plat} data-mp-etat={p.etat}
              data-mp-n={p.n == null ? '' : p.n} data-mp-vendu={p.vendu == null ? '' : String(p.vendu)} data-mp-vendu-partiel={p.venduPartiel ? '1' : undefined}
              data-mp-mediane={p.mediane == null ? '' : String(p.mediane)} data-mp-total={p.total == null ? '' : String(p.total)}
              data-mp-fin={p.nFin} data-mp-connu={p.nConnu} data-mp-sans-achat={p.nSansAchat}>
              <span className="vrm-mp-nom">{NOM[p.plat]}</span>
              <span className="vrm-mp-med"><b className="vrm-display">{t.mediane}</b>{p.mediane != null ? <small> médiane</small> : null}</span>
              <span className="vrm-mp-piste" aria-hidden="true"><span data-plus={R.meilleur === p.plat ? '1' : undefined} style={{ width: `${w}%` }}/></span>
              {p.etat === 'lu' && p.n === 0 && !p.nFin ? (
                <span className="vrm-mp-sur" data-mp-aucune="">Aucune vente sur la période</span>
              ) : (<>
                {p.etat === 'lu' ? (
                  <span className="vrm-mp-chiffres">{t.ventes} · {t.vendu} vendu{p.total != null ? <> · {t.total} en tout</> : null}</span>
                ) : null}
                <span className="vrm-mp-sur" data-mp-raison={p.etat !== 'lu' ? (p.raison || p.etat) : undefined}>{t.sur}</span>
              </>)}
              {t.manques && t.manques.length ? <span className="vrm-mp-manque">{t.manques.join(' · ')}</span> : null}
            </li>
          );
        })}
      </ol>
      {sansAchat > 0 && onSaisirPrix ? (
        <button type="button" className="vrm-lien-action vrm-mp-saisir" data-mp-saisir={sansAchat} onClick={onSaisirPrix}>Saisir les prix d’achat ›</button>
      ) : null}
    </section>
  );
}
