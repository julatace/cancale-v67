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
import { Carte, Rangee } from './natif/index.js';
import { tr } from './i18n/index.js';
import './natif/ecrans/argent.css';

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
  // (20 nov., lot argent-natif) AU STYLE NATIF §2 bis : une carte à filet, une rangée par source (le nom, « sur N ventes »
  // en gris, le bénéfice moyen à droite, aligné), le manque NOMMÉ en lignes grises dessous. Les mêmes textes (`texteSource`).
  let corps;
  if (!r) corps = <Rangee titre="—" sousTitre="ouvre Ventes pour les calculer" attrs={{ 'data-sa-etat': 'passu' }}/>;
  else if (!r.n) corps = <Rangee titre="Aucune vente finalisée sur la période." attrs={{ 'data-sa-etat': 'lu', 'data-sa-n': '0' }}/>;
  else corps = (
    <div className="vrm-sa" data-sa-etat="lu" data-sa-n={r.n}>
      {r.groupes.map((g) => {
        const t = texteSource(g);
        return <Rangee key={g.cle} titre={g.libelle} sousTitre={t.sur} valeur={t.montant} valeurForte
          attrs={{ 'data-sa-source': g.cle, 'data-sa-moyenne': g.moyenne == null ? '' : String(g.moyenne), 'data-sa-n': g.n, 'data-sa-connu': g.nConnu, 'data-sa-partiel': g.partiel ? '1' : undefined }}/>;
      })}
      {r.sansSource ? <p className="n-arg-pied" data-sa-sans-source={r.sansSource}>{tr('mtb.sansSource', { n: r.sansSource })}</p> : null}
      {r.sansAchat ? <p className="n-arg-pied" data-sa-sans-achat={r.sansAchat}>{tr('mtb.sansAchatRelie', { n: r.sansAchat })}</p> : null}
    </div>
  );
  return <Carte titre="D’où viennent mes achats" sousTitre="bénéfice moyen" className="vrm-sa-carte" attrs={{ 'data-stats-carte': 'sources-achats' }}>{corps}</Carte>;
}
