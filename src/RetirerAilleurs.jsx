// ── « RETIRER DES AUTRES SITES » : le bloc de Ma journée (feuille) et de Ventes (11 nov.) ──
// Chaque article vendu sur un site et encore en ligne ailleurs (le plan de
// src/retirerAilleurs.js), et, pour chaque site, ce qui s'y passe :
//   · ce que VRM retire sur SON clic (Leboncoin par l'extension, eBay par la route) ;
//   · « à faire sur le site » avec le lien (Vinted — jamais automatique, §3 —, Vestiaire) ;
//   · « peut-être encore en ligne · vérifier » (lecture ancienne, état pas confirmé, deux
//     annonces sous ce N°) : rien n'y part.
// UN bouton pour tout ce que VRM peut faire ; après, le résultat honnête par site
// (retiré ✓ relu / retiré, pas encore relu / pas fait : raison / pas su).
import React from 'react';
import { BoutonBase } from './composants/Bouton.jsx';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { phraseArticle, texteResultat } from './retirerAilleurs.js';
import './retirer-ailleurs.css';

const LIEN_SITE = { Vinted: 'https://www.vinted.fr/', Vestiaire: 'https://fr.vestiairecollective.com/', Leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', eBay: 'https://www.ebay.fr/sh/lst/active' };
const ETAT = { auto: 'VRM le retire', main: 'à faire sur le site', verifier: 'vérifier' };

export function RetirerAilleursBloc({ plan, resultats = null, enVol = false, onRetirer, onFini, PhotoVinted = null, compact = false }) {
  if (!plan || !plan.articles || !plan.articles.length) return null;
  const fait = !!(resultats && Object.keys(resultats).length);
  // Dans la feuille « Vendus ailleurs » (compact), le détail d'en dessous dit déjà chaque
  // annonce : le bloc ne s'y pose que s'il apporte quelque chose (un retrait possible, un
  // résultat, un « peut-être »).
  if (compact && !fait && !plan.nAuto && !plan.nVerifier) return null;
  const n = plan.nAuto;
  return (
    <section className={'vrm-ra' + (compact ? ' is-compact' : '')} data-retirer-ailleurs-bloc="" data-ra-auto={String(n)} data-ra-main={String(plan.nMain)} data-ra-verifier={String(plan.nVerifier)} aria-label="Vendu, encore en ligne ailleurs">
      <div className="vrm-ra-tete">
        <h3>Vendu, encore en ligne ailleurs</h3>
        {n > 0 && !fait ? (
          <BoutonBase variante="danger" className="vrm-ra-bouton" data-retirer-ailleurs="" occupe={enVol} onClick={onRetirer}
            title={`VRM retire ${n} annonce${n > 1 ? 's' : ''}, après confirmation`}>Retirer des autres sites</BoutonBase>
        ) : null}
        {fait && onFini ? <BoutonBase variante="discret" data-ra-fini="" disabled={enVol} onClick={onFini}>OK</BoutonBase> : null}
      </div>
      {plan.articles.map((art) => (
        <article key={art.numero} className="vrm-ra-article" data-ra-numero={art.numero} data-ra-vendu={art.venduSur.join(' ')}>
          <div className="vrm-ra-photo">{art.photo && PhotoVinted ? <PhotoVinted src={art.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}</div>
          <div className="vrm-ra-corps">
            <strong className="vrm-ra-phrase" data-ra-phrase="">{fait ? `N°${art.numero} vendu sur ${art.venduSur.join(', ') || '—'}` : phraseArticle(art)}</strong>
            {art.titre ? <small className="vrm-ra-titre">{art.titre}</small> : null}
            <ul className="vrm-ra-sites">
              {art.sites.map((s) => {
                const r = resultats && resultats[s.cle];
                const lien = s.lien || LIEN_SITE[s.plateforme] || null;
                return (
                  <li key={s.cle} data-ra-site={s.cle} data-ra-plateforme={s.plateforme} data-ra-voie={s.voie} data-ra-statut={r ? (r.statut === 'retire' && r.relu ? 'relu' : r.statut) : ''}
                    className={r ? (r.statut === 'retire' ? 'is-ok' : 'is-ko') : s.voie === 'auto' ? '' : 'is-main'}>
                    <span className="vrm-ra-site-txt">
                      <b>{s.plateforme}{s.compteNom ? ` · ${s.compteNom}` : ''}</b>
                      <small>{r ? texteResultat(r) : `${ETAT[s.voie]} · ${s.raison}`}</small>
                    </span>
                    {(s.voie !== 'auto' || (r && r.statut !== 'retire')) && lien ? (
                      <a className="vrm-ra-lien" href={lien} target="_blank" rel="noopener noreferrer" data-ra-ouvrir={s.cle}>{s.lien ? 'Ouvrir l’annonce ↗' : `Ouvrir ${s.plateforme} ↗`}</a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      ))}
      {plan.ambigus > 0 ? <p className="vrm-ra-note" data-ra-ambigus={String(plan.ambigus)}>{plan.ambigus} N° porté{plan.ambigus > 1 ? 's' : ''} par deux paires : aucun retrait proposé (vérifie le N° sur le carton).</p> : null}
      {plan.manques.length && !compact ? <p className="vrm-ra-note" data-ra-manques="">Pas tout relu : {plan.manques.join(', ')}. Ce qui n’est pas lu n’est ni affirmé ni retiré.</p> : null}
    </section>
  );
}
export default RetirerAilleursBloc;
