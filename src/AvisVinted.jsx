// ════════════════════════════════════════════════════════════════════════════
//  LES AVIS VINTED LUS (10 nov., lot BN) — dans la carte « Notes reçues » de
//  Statistiques. Lecture seule, AUCUN rappel d'évaluation (refusé le 11 oct.).
//  La règle : src/notesRecues.js (`notesParCompte` → `liste` de chaque compte).
//  Par compte : la moyenne des avis LUS (« sur les 20 derniers, 2 304 en tout »),
//  l'évolution (10 derniers contre 10 d'avant, neutre, jamais rouge ni vert), et
//  les 5 derniers : étoiles, date SEULEMENT si elle est lue (Vinted ne la donne
//  pas aujourd'hui), le texte court. Jamais le pseudo de l'acheteur (l'extension
//  ne le range pas). Rien de capté ⇒ « Avis pas encore lus : ouvre ton profil
//  Vinted » — jamais « aucun avis ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { texteCourtAvis } from './notesRecues.js';
import './styles-vitesse-avis.css';

const noteFr = (x) => (x == null ? '—' : String(x).replace('.', ','));
const nFr = (n) => Number(n).toLocaleString('fr-FR');
const jour = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Etoiles({ n }) {
  return (
    <span className="vrm-av-etoiles" role="img" aria-label={`${n} sur 5`} data-av-note={n}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" data-plein={i <= n ? '1' : undefined}>★</span>)}
    </span>
  );
}

function Evolution({ e }) {
  if (!e) return null;
  const d = e.sens === 'egal' ? 'M2 6h8' : e.sens === 'hausse' ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5';
  return (
    <span className="vrm-av-evol" data-av-evolution={e.sens} data-av-recent={e.recent} data-av-avant={e.avant}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {e.nRecent} derniers {noteFr(e.recent)} · avant {noteFr(e.avant)}
    </span>
  );
}

export default function AvisLus({ comptes = [] }) {
  const avec = comptes.filter((c) => c && c.liste);
  if (!avec.length) {
    return <p className="vrm-av-vide" data-sv-notes-liste="pas-lue">Avis pas encore lus : ouvre ton profil Vinted.</p>;
  }
  return (
    <div className="vrm-av" data-sv-notes-liste="lue">
      {comptes.map((c) => {
        if (!c) return null;
        if (!c.liste) return <p key={c.uid} className="vrm-av-vide" data-av-compte={c.uid} data-av-etat="pas-lu">{c.nom} : avis pas encore lus — ouvre son profil Vinted.</p>;
        const L = c.liste;
        return (
          <section key={c.uid} className="vrm-av-compte" data-av-compte={c.uid} data-av-etat="lu" data-av-lus={L.lus} data-av-moyenne={L.moyenneLus == null ? '' : L.moyenneLus} data-av-total={L.total == null ? '' : L.total}>
            <div className="vrm-av-tete">
              <span className="vrm-av-nom">Derniers avis{comptes.length > 1 ? ` · ${c.nom}` : ''}</span>
              <b className="vrm-display vrm-av-moy">{noteFr(L.moyenneLus)}<small>/5</small></b>
            </div>
            <div className="vrm-av-sous">
              <span data-av-couverture="">{L.lus ? `moyenne des ${L.lus} derniers lus${L.total != null && L.total > L.lus ? ` · ${nFr(L.total)} en tout` : ''}` : 'aucun avis lisible'}</span>
              <Evolution e={L.evolution}/>
            </div>
            {L.dernieres.length ? (
              <ol className="vrm-av-liste">
                {L.dernieres.map((x) => (
                  <li key={x.id || x.rang} className="vrm-av-avis" data-av-avis={x.id} data-av-date={x.ts == null ? '' : x.ts}>
                    <Etoiles n={x.note}/>
                    {x.ts != null ? <span className="vrm-av-date">{jour(x.ts)}</span> : null}
                    {x.texte ? <span className="vrm-av-texte" title={x.texte}>« {texteCourtAvis(x.texte)} »</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        );
      })}
      {avec.some((c) => c.liste.dernieres.some((x) => x.ts == null)) ? <p className="vrm-av-note" data-av-sans-date="">Vinted ne donne pas la date des avis : du plus récent au plus ancien.</p> : null}
    </div>
  );
}
