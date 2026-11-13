// ═══════════════════════════════════════════════════════════════════════════
// LA VIDÉO DU « ? » (13 nov., lot 49) — données : src/aideVideos.js
// ═══════════════════════════════════════════════════════════════════════════
// Dans la feuille du « ? » : une rangée « Regarder » par vidéo (son aperçu, son
// titre, sa durée). La vidéo n'est DEMANDÉE qu'au toucher : avant, aucun
// <video> n'existe dans la page. Lue sans son (`muted`, elle n'en a pas), en
// ligne (`playsInline`, iPhone), avec ses commandes ; les titres sont incrustés
// et la piste `.vtt` les porte aussi (lecteurs d'écran, « Sous-titres »).
// Hors connexion : elle le dit, rien d'autre ne casse.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { VIDEOS_AIDE, videosDe, urlVideo, dureeLisible } from '../aideVideos.js';

const Lecture = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6.5 4.2v11.6a.7.7 0 0 0 1.06.6l9.3-5.8a.7.7 0 0 0 0-1.2l-9.3-5.8a.7.7 0 0 0-1.06.6Z" fill="currentColor"/></svg>
);

export function AideVideo({ cle }) {
  const ids = videosDe(cle);
  const [lue, setLue] = React.useState(null);      // id en lecture
  const [panne, setPanne] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { setPanne(false); if (lue && ref.current && ref.current.focus) { try { ref.current.focus({ preventScroll: true }); } catch (_) {} } }, [lue]);
  if (!ids.length) return null;
  const v = lue ? VIDEOS_AIDE[lue] : null;
  return (
    <div className="vrm-aide-videos" data-aide-videos={ids.join(',')}>
      {v ? (
        <figure className="vrm-aide-video" data-aide-video-lecteur={lue}>
          <video ref={ref} key={lue} src={urlVideo(lue)} poster={urlVideo(lue, 'jpg')} controls autoPlay muted playsInline preload="auto"
            width={720} height={1280} aria-label={`Vidéo : ${v.titre}. ${v.geste}.`} onError={() => setPanne(true)}>
            <track kind="captions" src={urlVideo(lue, 'vtt')} srcLang="fr" label="Français"/>
          </video>
          <figcaption>
            <span><b>{v.titre}</b> · {v.geste}</span>
            <button type="button" className="vrm-lien-action" onClick={() => setLue(null)} data-aide-video-fermer="">Fermer la vidéo</button>
          </figcaption>
          {panne ? <p className="vrm-aide-video-panne" role="status" data-aide-video-panne="">La vidéo n’a pas pu se lire ici (réseau ?). Les gestes sont écrits juste dessous.</p> : null}
        </figure>
      ) : null}
      <ul className="vrm-aide-groupe vrm-aide-video-liste">
        {ids.filter((id) => id !== lue).map((id) => {
          const x = VIDEOS_AIDE[id];
          return (
            <li key={id}>
              <button type="button" className="vrm-aide-video-ouvrir" onClick={() => setLue(id)} data-aide-video={id} aria-label={`Regarder la vidéo : ${x.titre}, ${dureeLisible(x.duree)}`}>
                <span className="vrm-aide-video-apercu" aria-hidden="true">
                  <img src={urlVideo(id, 'jpg')} alt="" width={45} height={80} loading="lazy" decoding="async"/>
                  <span className="vrm-aide-video-play"><Lecture/></span>
                </span>
                <span className="vrm-aide-video-texte"><b>Regarder : {x.titre}</b><small>{x.geste} · {dureeLisible(x.duree)}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AideVideo;
