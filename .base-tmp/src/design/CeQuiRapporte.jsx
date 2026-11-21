// ═══════════════════════════════════════════════════════════════════════════
// « CE QUI RAPPORTE LE PLUS » — la carte de Statistiques (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Un classement segmenté (Modèle · Marque · Taille · Compte · Site) des ventes
// finalisées de la PÉRIODE choisie : bénéfice brut total et moyen, marge, nombre
// vendu, temps pour vendre en mots, et la couverture (« prix d'achat connus
// 32/38 »). Toucher une ligne ouvre les articles concernés. Rien n'est calculé
// ici : tout vient de `classementRapporte` (src/ceQuiRapporte.js).
// Chaque nombre rendu porte son attribut (centimes, '' = « — ») pour le banc.
import React from 'react';
import { AXES_RAPPORTE, classementRapporte, phraseMoitie } from '../ceQuiRapporte.js';

const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));
const VISIBLES = 6;

export default function CeQuiRapporte({ lignes, Segmente, fmt, etat }) {
  const [axe, setAxe] = React.useState(() => { try { const v = localStorage.getItem('vrm_cr_axe'); return AXES_RAPPORTE[v] ? v : 'modele'; } catch (_) { return 'modele'; } });
  const [ouvert, setOuvert] = React.useState(null);
  const [tout, setTout] = React.useState(false);
  const choisir = (v) => { setAxe(v); setOuvert(null); setTout(false); try { localStorage.setItem('vrm_cr_axe', v); } catch (_) {} };
  const C = React.useMemo(() => (Array.isArray(lignes) ? classementRapporte(lignes, axe) : null), [lignes, axe]);
  const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const jour = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const montant = (v) => (v == null ? '—' : fmt(v));

  let corps;
  if (!C) corps = <div className="vrm-cr-vide" data-cr-etat={etat || 'passu'}>—</div>;
  else if (!C.groupes.length) corps = <div className="vrm-cr-vide" data-cr-etat="lu" data-cr-n="0">Aucune vente finalisée sur la période.</div>;
  else {
    const vus = tout ? C.groupes : C.groupes.slice(0, VISIBLES);
    corps = (
      <ol className="vrm-cr-liste" data-cr-etat="lu">
        {vus.map((g, rang) => {
          const ouv = ouvert === g.k;
          const phrase = phraseMoitie(g.mediane);
          return (
            <li key={g.k || '_autres'} className="vrm-cr-item" data-cr-ligne={g.k || 'autres'} data-n={g.n} data-ncout={g.nCout} data-brut={cents(g.brut)}
              data-moyen={cents(g.moyen)} data-marge={g.marge == null ? '' : g.marge} data-mediane={g.mediane == null ? '' : g.mediane} data-ndelai={g.nDelai} data-ouvert={ouv ? '1' : undefined}>
              <button type="button" className="vrm-cr-ligne" aria-expanded={ouv} onClick={() => setOuvert(ouv ? null : g.k)}>
                <span className="vrm-cr-rang">{rang + 1}</span>
                <span className="vrm-cr-centre">
                  <span className="vrm-cr-nom">{g.nom}</span>
                  <span className="vrm-cr-sous">
                    <span className="vrm-cr-bloc">{pl(g.n, 'vendu')}</span>{g.moyen != null ? <> · <span className="vrm-cr-bloc">moy. {fmt(g.moyen)}</span></> : null}{g.marge != null ? <> · <span className="vrm-cr-bloc">marge {String(g.marge).replace('.', ',')}&nbsp;%</span></> : null}
                  </span>
                  {phrase ? <span className="vrm-cr-sous vrm-cr-delai">{phrase}</span> : null}
                </span>
                <span className="vrm-cr-droite">
                  <span className="vrm-cr-brut" data-vide={g.brut == null ? '1' : undefined}>{montant(g.brut)}</span>
                  {g.nCout < g.n ? <span className="vrm-cr-couv" data-cr-couv-ligne={`${g.nCout}/${g.n}`}>{g.nCout}/{g.n}</span> : null}
                </span>
              </button>
              {ouv && (
                <ul className="vrm-cr-articles" data-cr-articles={g.lignes.length}>
                  {g.lignes.map((i) => {
                    const l = lignes[i];
                    const connu = l.achat != null && String(l.achat).trim() !== '' && isFinite(Number(l.achat));
                    const brut = connu ? (Math.round(Number(l.eur) * 100) - Math.round(Number(l.achat) * 100)) / 100 : null;
                    return (
                      <li key={`${l.plateforme}|${l.id}|${i}`} className="vrm-cr-article" data-cr-article={l.id} data-brut={cents(brut)}>
                        <span className="vrm-cr-article-titre">{l.titre || l.plateforme}</span>
                        <span className="vrm-cr-article-sous">{jour(l.ts)} · {l.plateforme === 'Vinted' ? (l.compte || 'Vinted') : l.plateforme} · {fmt(l.eur)}</span>
                        <span className="vrm-cr-article-brut" data-vide={brut == null ? '1' : undefined}>{brut == null ? '—' : fmt(brut)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
        {C.groupes.length > VISIBLES && (
          <li className="vrm-cr-plus"><button type="button" className="vrm-lien-action" data-cr-tout={tout ? '1' : '0'} onClick={() => setTout(!tout)}>{tout ? 'Moins' : `Tout voir (${C.groupes.length})`}</button></li>
        )}
      </ol>
    );
  }
  // (5 nov., chantier F, revue 2.25) Rien à classer sur la période : la carte se replie en
  // une ligne (son titre, la raison) — le choix « Modèle · Marque… » ne sert à rien à vide.
  if (!C || !C.groupes.length) {
    return (
      <section className="vrm-cr vrm-sv-carte vrm-sv-repliee" data-stats-carte="sv-rapporte" data-sv-repliee="" data-cr-axe={axe} data-cr-n={C ? C.n : ''} data-cr-ncout={C ? C.nCout : ''} data-cr-ecartees={C ? C.ecartees : ''}>
        <h2 className="vrm-sv-repliee-titre">Ce qui rapporte le plus</h2>
        <span className="vrm-sv-repliee-raison vrm-cr-vide" data-cr-etat={C ? 'lu' : (etat || 'passu')} data-cr-n={C ? '0' : undefined}>{C ? 'Aucune vente finalisée sur la période.' : etat === 'encours' ? 'Lecture en cours…' : 'Tes ventes ne sont pas encore lues.'}</span>
      </section>
    );
  }
  return (
    <section className="vrm-cr" data-stats-carte="sv-rapporte" data-cr-axe={axe} data-cr-n={C ? C.n : ''} data-cr-ncout={C ? C.nCout : ''} data-cr-ecartees={C ? C.ecartees : ''}>
      <div className="vrm-cr-tete">
        <h2 className="vrm-display vrm-cr-titre">Ce qui rapporte le plus</h2>
        {C && C.n > 0 ? <span className="vrm-cr-note" data-cr-couv={`${C.nCout}/${C.n}`}>prix d’achat connus {C.nCout}/{C.n}</span> : null}
      </div>
      <Segmente label="Classer par" className="vrm-cr-axes" value={axe} onChange={choisir} options={Object.entries(AXES_RAPPORTE).map(([v, l]) => ({ v, l, data: { 'data-cr-choix': v } }))}/>
      {corps}
    </section>
  );
}
