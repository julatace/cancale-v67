// ═══════════════════════════════════════════════════════════════════════════
// L'HISTORIQUE DES REPUBLICATIONS — l'écran (11 nov., lot republier-programme)
// ═══════════════════════════════════════════════════════════════════════════
// La règle : src/historiqueRepub.js (par IDENTITÉ seulement). Ici :
//  · `LigneHistoriqueRepub` — dans l'atelier, sous chaque annonce :
//    « republiée 3 fois · dernière il y a 12 j · +4 favoris » ;
//  · `BlocHistoriqueRepub` — sur la fiche de l'annonce : chaque republication, sa date et
//    ce qu'elle a donné (favoris, vues, vendue), « — » quand ce n'est pas su ;
//  · `useJournalRepub` — la ligne `vrm_repub_journal` (undefined lecture · null pas su).
// Tout le texte passe par tr() (clés `rh.*`, 5 langues).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateLoc } from './i18n/index.js';
import { AUTH } from './App.jsx';
import { lireJournal, historiqueAnnonce, resumeHistorique } from './historiqueRepub.js';
import { ctxLigne } from './RepubProgramme.jsx';
import './repub-programme.css';

export function useJournalRepub(actif = true) {
  const [j, setJ] = React.useState(undefined);
  React.useEffect(() => {
    if (!actif || !AUTH.user || !AUTH.user.id) return undefined;
    let vivant = true;
    const lire = () => lireJournal(ctxLigne()).then((x) => { if (vivant) setJ((v) => (x === null && v ? v : x)); });
    lire();
    window.addEventListener('vrm:repub-journal', lire);
    return () => { vivant = false; window.removeEventListener('vrm:repub-journal', lire); };
  }, [actif]);
  return j;
}

// Une phrase : « republiée 3 fois · dernière il y a 12 j · +4 favoris ».
export function texteResume(r) {
  if (!r) return '';
  const p = [tr('rh.fois', { n: r.n })];
  p.push(r.jours == null ? tr('rh.datePasSue') : r.jours === 0 ? tr('rh.aujourdhui') : tr('rh.ilYa', { n: r.jours }));
  if (r.favoris != null) p.push(tr('rh.plusFavoris', { n: r.favoris }));
  return p.join(' · ');
}

export function LigneHistoriqueRepub({ r, id }) {
  if (!r) return null;
  return <span className="vrm-rh-ligne" data-rh-ligne={id} data-rh-n={r.n} data-rh-jours={r.jours == null ? 'pas-su' : r.jours} data-rh-favoris={r.favoris == null ? 'pas-su' : r.favoris}>{texteResume(r)}</span>;
}

// d : { recrees, numeros, stats, vendues } ; `ids` : les annonces EN LIGNE de la fiche.
export function BlocHistoriqueRepub({ ids, d }) {
  const journal = useJournalRepub(true);
  const liste = (ids || []).map((id) => ({ id: String(id), h: historiqueAnnonce(id, { ...d, journal: journal || {} }) })).filter((x) => x.h && x.h.n);
  if (!liste.length) return null;
  return (
    <section className="vrm-rh" data-rh-bloc={liste.length} aria-label={tr('rh.titre')}>
      {liste.map(({ id, h }) => (
        <div key={id} data-rh-annonce={id}>
          <h4>{tr('rh.titre')} · {texteResume(resumeHistorique(h))}</h4>
          <ol>
            {h.liste.map((x) => (
              <li key={x.nouvelId} data-rh-republication={x.nouvelId} data-rh-de={x.ancienId}>
                <span>{x.at == null ? tr('rh.datePasSue') : dateLoc(x.at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>{[
                  x.resultat.vendue ? tr('rh.vendue') : null,
                  x.resultat.favoris == null ? tr('rh.favorisPasSu') : tr('rh.favoris', { n: x.resultat.favoris }),
                  x.resultat.vues == null ? tr('rh.vuesPasSu') : tr('rh.vues', { n: x.resultat.vues }),
                  x.resultat.enLigne ? tr('rh.enLigne') : null,
                ].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
