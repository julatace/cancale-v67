// ═══════════════════════════════════════════════════════════════════════════
// LA VIDÉO DU « ? » (13 nov., lot 49) — données : src/aideVideos.js
// ═══════════════════════════════════════════════════════════════════════════
// Dans la feuille du « ? » : une rangée « Regarder » par vidéo (son aperçu, son
// titre, sa durée). La vidéo n'est DEMANDÉE qu'au toucher : avant, aucun
// <video> n'existe dans la page. Lue sans son (`muted`, elle n'en a pas), en
// ligne (`playsInline`, iPhone), avec ses commandes ; les titres sont incrustés
// et la piste `.vtt` les porte aussi (lecteurs d'écran, « Sous-titres »).
// Hors connexion : elle le dit, rien d'autre ne casse.
// (17 nov., lot aide-videos — Julien : « l'aide sur place est déjà là avec les vidéos, mais tu peux
// les améliorer ») :
//   · au-dessus de chaque « Regarder », LA réponse en deux lignes (`av.<id>.reponse`) pour qui ne
//     veut pas regarder ; tous les textes par tr() ;
//   · des sous-titres dans les 5 langues (une piste par langue, celle de l'app par défaut) ;
//   · « Plein écran » au doigt (iPhone : le lecteur natif), et le RETOUR ferme la vidéo d'abord
//     (`FermeAuRetour`) avant la feuille ;
//   · `ids` : la liste à montrer (la recherche du « ? » passe les vidéos trouvées).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { VIDEOS_AIDE, videosDe, urlVideo, urlSousTitres, dureeLisible, LANGUES_SOUS_TITRES } from '../aideVideos.js';
import { tr, langueCourante, NOMS_LANGUES } from '../i18n/index.js';
import { FermeAuRetour } from '../App.jsx';

const Lecture = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.5 4.2v11.6a.7.7 0 0 0 1.06.6l9.3-5.8a.7.7 0 0 0 0-1.2l-9.3-5.8a.7.7 0 0 0-1.06.6Z" fill="currentColor"/></svg>
);
const PleinEcran = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M2.5 6.5v-4h4M11.5 2.5h4v4M15.5 11.5v4h-4M6.5 15.5h-4v-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

// Le texte d'une vidéo dans la langue de l'app (la recherche lit le même).
export const texteVideo = (id) => `${tr(`av.${id}.titre`)} ${tr(`av.${id}.geste`)} ${tr(`av.${id}.reponse`)}`;

// Plein écran au doigt : l'API standard, sinon le lecteur natif de l'iPhone. Rend true si demandé.
export function demanderPleinEcran(el) {
  if (!el) return false;
  try {
    if (typeof el.requestFullscreen === 'function') { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); return true; }
    if (typeof el.webkitEnterFullscreen === 'function') { el.webkitEnterFullscreen(); return true; }
    if (typeof el.webkitRequestFullscreen === 'function') { el.webkitRequestFullscreen(); return true; }
  } catch (_) {}
  return false;
}

export function AideVideo({ cle, ids: idsVoulus = null }) {
  const ids = Array.isArray(idsVoulus) ? idsVoulus.filter((id) => VIDEOS_AIDE[id]) : videosDe(cle);
  const [lue, setLue] = React.useState(null);      // id en lecture
  const [panne, setPanne] = React.useState(false);
  const ref = React.useRef(null);
  const langue = LANGUES_SOUS_TITRES.includes(langueCourante()) ? langueCourante() : 'fr';
  React.useEffect(() => { setPanne(false); if (lue && ref.current && ref.current.focus) { try { ref.current.focus({ preventScroll: true }); } catch (_) {} } }, [lue]);
  if (!ids.length) return null;
  const v = lue ? VIDEOS_AIDE[lue] : null;
  return (
    <div className="vrm-aide-videos" data-aide-videos={ids.join(',')}>
      {v ? (
        <figure className="vrm-aide-video" data-aide-video-lecteur={lue}>
          {/* Le retour ferme d'abord la vidéo, puis la feuille. */}
          <FermeAuRetour fermer={() => setLue(null)}/>
          <p className="vrm-aide-video-reponse" data-aide-video-reponse={lue}>{tr(`av.${lue}.reponse`)}</p>
          <video ref={ref} key={lue} src={urlVideo(lue)} poster={urlVideo(lue, 'jpg')} controls autoPlay muted playsInline preload="metadata"
            width={720} height={1280} aria-label={tr('av.lecteur', { titre: tr(`av.${lue}.titre`), geste: tr(`av.${lue}.geste`) })} onError={() => setPanne(true)}>
            {LANGUES_SOUS_TITRES.map((l) => <track key={l} kind="captions" src={urlSousTitres(lue, l)} srcLang={l} label={(NOMS_LANGUES && NOMS_LANGUES[l]) || l} default={l === langue ? true : undefined} data-aide-video-piste={l}/>)}
          </video>
          <figcaption>
            <span><b>{tr(`av.${lue}.titre`)}</b> · {tr(`av.${lue}.geste`)}</span>
            <span className="vrm-aide-video-gestes">
              <button type="button" className="vrm-lien-action vrm-aide-video-plein" onClick={() => demanderPleinEcran(ref.current)} data-aide-video-plein=""><PleinEcran/>{tr('av.pleinEcran')}</button>
              <button type="button" className="vrm-lien-action" onClick={() => setLue(null)} data-aide-video-fermer="">{tr('av.fermer')}</button>
            </span>
          </figcaption>
          {panne ? <p className="vrm-aide-video-panne" role="status" data-aide-video-panne="">{tr('av.panne')}</p> : null}
        </figure>
      ) : null}
      <ul className="vrm-aide-groupe vrm-aide-video-liste">
        {ids.filter((id) => id !== lue).map((id) => {
          const x = VIDEOS_AIDE[id];
          return (
            <li key={id}>
              {/* (17 nov.) La réponse en deux lignes, AVANT la vidéo : on n'a pas besoin de la regarder. */}
              <p className="vrm-aide-video-reponse" data-aide-video-reponse={id}>{tr(`av.${id}.reponse`)}</p>
              <button type="button" className="vrm-aide-video-ouvrir" onClick={() => setLue(id)} data-aide-video={id}>{/* (16 nov., accessibilite-feuilles) son NOM est son texte visible (« Regarder : … · 0:15 ») : un aria-label différent cachait ce qu'on lit (WCAG 2.5.3) */}
                <span className="vrm-aide-video-apercu" aria-hidden="true">
                  <img src={urlVideo(id, 'jpg')} alt="" width={45} height={80} loading="lazy" decoding="async"/>
                  <span className="vrm-aide-video-play"><Lecture/></span>
                </span>
                <span className="vrm-aide-video-texte"><b>{tr('av.regarder', { titre: tr(`av.${id}.titre`) })}</b><small>{tr(`av.${id}.geste`)} · {dureeLisible(x.duree)}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AideVideo;
