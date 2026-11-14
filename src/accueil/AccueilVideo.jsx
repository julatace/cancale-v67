// ── « VOIR VRM EN 45 S » (14 nov., idée d'accueil 146) ─────────────────────
// En tête de la page d'accueil : un bouton discret sous les deux gestes du haut.
// RIEN n'est téléchargé avant son toucher (ni la vidéo, ni l'affiche) : la page
// garde son budget de poids. Au toucher : l'affiche, puis la vidéo (720 × 1280,
// ≤ 2 Mo, `preload="metadata"`), lue en silence (aucune piste audio), avec ses
// commandes (jamais en boucle) ; les sous-titres de la langue de la page sont montrés
// (pistes fr, en, es, it, de). Tournée dans la vraie app sur des données inventées
// (scripts/films/accueil-video.cjs), et la légende le dit.
import React from 'react';
import { tr, langueCourante, LANGUES, NOMS_LANGUES as NOMS } from '../i18n/index.js';

// Les styles de la page (`.av`, ses variables) : ici, pour ne rien ajouter au bloc de la page.
const CSS = `
.av-video-voir{display:flex;align-items:center;gap:8px;min-height:44px;margin:16px auto 0;padding:0 4px;border:0;background:none;color:var(--accent-texte);font:inherit;font-size:17px;font-weight:600;cursor:pointer}
.av-video-voir:active{transform:scale(.97)}
.av-video{margin:24px auto 0;max-width:320px;text-align:center}
.av-video-film{display:block;width:100%;height:auto;aspect-ratio:9/16;border-radius:28px;background:var(--fond2);box-shadow:var(--ombre)}
.av-video .av-legende{text-align:center}
.av-video-fermer{min-height:44px;padding:0 6px;border:0;background:none;color:var(--accent-texte);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
@media (prefers-reduced-motion:reduce){.av-video-voir:active{transform:none}}
`;
export default function AccueilVideo() {
  const [ouverte, setOuverte] = React.useState(false);
  const ref = React.useRef(null);
  const l = langueCourante();
  React.useEffect(() => {
    if (!ouverte || !ref.current) return;
    try { const v = ref.current; for (const t of v.textTracks || []) t.mode = t.language === l ? 'showing' : 'disabled'; v.play && v.play().catch(() => {}); } catch (_) {}
  }, [ouverte, l]);
  if (!ouverte) {
    return (
      <>
      <style>{CSS}</style>
      <button type="button" className="av-video-voir" data-accueil-video="" onClick={() => setOuverte(true)}>
        <svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 6.5v7l5.5-3.5z" fill="currentColor" /></svg>
        {tr('accueil.video.voir')}
      </button>
      </>
    );
  }
  return (
    <figure className="av-video" data-accueil-video="ouverte">
      <style>{CSS}</style>
      <video ref={ref} className="av-video-film" src="/accueil/film-45s.mp4" poster="/accueil/film-45s.jpg" width={720} height={1280}
        controls muted playsInline preload="metadata" aria-label={tr('accueil.video.titre')} data-accueil-video-film="">
        {LANGUES.map((x) => <track key={x} kind="subtitles" srcLang={x} label={NOMS[x]} src={`/accueil/film-45s.${x}.vtt`} default={x === l} />)}
      </video>
      <figcaption className="av-legende">{tr('accueil.video.legende')}
        {' '}<button type="button" className="av-video-fermer" data-accueil-video-fermer="" onClick={() => setOuverte(false)}>{tr('accueil.video.fermer')}</button>
      </figcaption>
    </figure>
  );
}
