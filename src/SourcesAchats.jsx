// ════════════════════════════════════════════════════════════════════════════
//  « D'OÙ VIENNENT MES ACHATS » (10 nov., lot BG) — UNE carte de Statistiques,
//  isolée : elle LIT la publication de l'écran Ventes (`vrm_sources_ventes`,
//  src/sourceAchats.js) et la période de l'écran ; elle ne recalcule ni bénéfice
//  ni source. Une barre par source (la plus rentable à l'accent, les autres
//  neutres), « 32 € en moyenne · sur 14 ventes », le manque NOMMÉ dessous.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { beneficeParSource, texteSource, lireSources, CLE_SOURCES, EVT_SOURCES } from './sourceAchats.js';
import './styles-sources-achats.css';

export function useSources(owner) {
  const [v, setV] = useState(() => lireSources(owner));
  useEffect(() => {
    const relire = () => setV(lireSources(owner));
    relire();
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_SOURCES) relire(); };
    window.addEventListener(EVT_SOURCES, relire);
    window.addEventListener('storage', surStockage);
    return () => { window.removeEventListener(EVT_SOURCES, relire); window.removeEventListener('storage', surStockage); };
  }, [owner]);
  return v;
}

const pl = (k, s, p) => `${k} ${k > 1 ? (p || s + 's') : s}`;

// owner : le compte VRM ; de, a : les bornes de la période (ms).
export default function SourcesAchats({ owner = '', de, a }) {
  const pub = useSources(owner);
  const r = useMemo(() => (pub ? beneficeParSource(pub.lignes.filter((l) => Number.isFinite(l.ts) && l.ts >= de && l.ts < a)) : null), [pub, de, a]);
  const max = r ? Math.max(0, ...r.groupes.map((g) => g.moyenne || 0)) : 0;
  const tete = <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">D’où viennent mes achats</h2><span className="vrm-sv-note">bénéfice moyen</span></div>;
  let corps;
  if (!r) corps = <p className="vrm-sa-vide" data-sa-etat="passu">— · ouvre Ventes pour les calculer</p>;
  else if (!r.n) corps = <p className="vrm-sa-vide" data-sa-etat="lu" data-sa-n="0">Aucune vente finalisée sur la période.</p>;
  else corps = (
    <div className="vrm-sa" data-sa-etat="lu" data-sa-n={r.n}>
      {r.groupes.length ? <ol className="vrm-sa-liste">
        {r.groupes.map((g, i) => {
          const t = texteSource(g);
          const w = g.moyenne != null && g.moyenne > 0 && max > 0 ? Math.max(3, (g.moyenne / max) * 100) : 0;
          return (
            <li key={g.cle} className="vrm-sa-ligne" data-sa-source={g.cle} data-sa-moyenne={g.moyenne == null ? '' : String(g.moyenne)} data-sa-n={g.n} data-sa-connu={g.nConnu} data-sa-partiel={g.partiel ? '1' : undefined}>
              <span className="vrm-sa-nom">{g.libelle}</span>
              <span className="vrm-sa-piste" aria-hidden="true"><span data-plus={i === 0 && g.moyenne != null && g.moyenne > 0 ? '1' : undefined} style={{ width: `${w}%` }}/></span>
              <span className="vrm-sa-montant">{t.montant}</span>
              <span className="vrm-sa-sur">{t.sur}</span>
            </li>
          );
        })}
      </ol> : null}
      {r.sansSource ? <p className="vrm-sa-note" data-sa-sans-source={r.sansSource}>{pl(r.sansSource, 'vente')} : source pas saisie sur l’achat (Achats → l’achat → « Où »).</p> : null}
      {r.sansAchat ? <p className="vrm-sa-note" data-sa-sans-achat={r.sansAchat}>{pl(r.sansAchat, 'vente')} sans achat relié : source pas sue.</p> : null}
    </div>
  );
  return <section className="vrm-sv-carte vrm-sa-carte" data-stats-carte="sources-achats">{tete}{corps}</section>;
}
