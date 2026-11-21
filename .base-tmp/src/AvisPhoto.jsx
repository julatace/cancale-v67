// ── « FLOUE ? » / « SOMBRE ? » SUR UNE PHOTO (14 nov., proposition 102) ───────────
// Un mot discret posé sur la vignette d'une photo À LUI, avant qu'il la mette en ligne.
// Le verdict vient de src/qualitePhoto.js, mesuré sur CE téléphone (worker) ; il est
// soit DÉJÀ rangé avec la photo (`qualite`, le studio le garde), soit calculé ici.
// ⚠️ Un SIMPLE AVERTISSEMENT : rien n'est retiré, rien n'est refusé, aucun bouton n'est
// éteint — il garde sa photo s'il veut. Une photo nette, ou qu'on n'a pas pu juger
// (« pas su »), n'affiche RIEN. Ambre : un geste possible (§7), jamais rouge.
import React from 'react';
import { analyserPhoto } from './qualitePhotoClient.js';
import { tr } from './i18n/index.js';

const CLE = { flou: 'atelier.avis.flou', sombre: 'atelier.avis.sombre', 'flou-sombre': 'atelier.avis.flouSombre' };

export function useQualitePhoto(src, qualite = null) {
  const [q, setQ] = React.useState(qualite || undefined);
  React.useEffect(() => {
    if (qualite) { setQ(qualite); return undefined; }
    let vivant = true; setQ(undefined);
    if (src) analyserPhoto(src).then((r) => { if (vivant) setQ(r || null); });
    return () => { vivant = false; };
  }, [src, qualite]);
  return q;
}

export default function AvisPhoto({ src, qualite = null, onMesure = null, variante = 'pastille' }) {
  const q = useQualitePhoto(src, qualite);
  const dejaDit = React.useRef(null);
  React.useEffect(() => { if (q !== undefined && onMesure && dejaDit.current !== q) { dejaDit.current = q; onMesure(q); } }, [q, onMesure]);
  const juge = q && q.juge;
  if (!juge || !CLE[juge]) return <span hidden data-avis-photo={q === undefined ? 'calcul' : (juge || 'passu')}/>;
  return (
    <span className={'vrm-avis-photo is-' + variante} role="status" data-avis-photo={juge} title={tr('atelier.avis.pourquoi')}>
      <span className="vrm-avis-photo-point" aria-hidden="true"/>{tr(CLE[juge])}
    </span>
  );
}
