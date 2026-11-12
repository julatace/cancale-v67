// La frise « Fusion » : quatre segments, un libellé sous chacun.
// Franchi = trait bleu (le seul bleu de la ligne avec le bouton principal) ; le
// MOT à l'encre seulement sur la dernière étape faite (`data-derniere`, 5 nov.) ;
// en cours = gris, ou ambre si un geste est à faire ; à venir = gris. Rien n'est calculé
// ici : les étapes viennent de src/design/friseFusion.js (projection des règles).
// `data-fu-frise` porte l'identité (n° de transaction), chaque segment son
// `data-fu-etape`, `data-fait` (1/0), `data-preuve`, `data-cours` : le banc juge
// la règle sur ces attributs, jamais sur un libellé.
// (6 nov.) Une étape au libellé long (`court`, « Au centre de vérification ») écrit
// son mot court sous le trait (cinq segments à 390 px) ; le nom entier reste lu.
// (11 nov., lot ventes-achats-visuel — Julien : « ces visuels ne sont pas top du tout »)
// UNE BARRE FINE, UN SEUL MOT. Les quatre libellés colorés sous quatre traits épais
// deviennent une barre de 3 px et l'étape ACTUELLE nommée une fois, sous la barre
// (`data-fu-legende` : « Postée · 9 nov. » — la dernière étape faite et sa date quand
// la preuve est datée ; rien de fait ⇒ l'étape en cours). Le nom de chaque étape et
// son état restent dans chaque segment, pour VoiceOver (`vrm-fu-sr`). Les couleurs :
// neutre, le bleu sur l'étape actuelle seulement, l'ambre sur l'étape en cours si un
// geste est dû (styles-ventes-achats-visuel.css). Aucune règle neuve : la légende LIT
// `derniere` / `cours` / `t` que friseFusion.js a posés.
// `inline` : rendue DANS le bouton d'une ligne (Ventes) — des <span> (une liste n'a
// rien à faire dans un bouton), mêmes attributs.
import React from 'react';

const jourCourt = (t) => {
  if (t == null || t === '') return '';
  const d = new Date(typeof t === 'number' ? t : String(t));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// L'étape nommée sous la barre : la dernière faite (avec sa date si elle est prouvée et
// datée), sinon l'étape en cours ; aucune ⇒ rien.
export function legendeFrise(etapes) {
  if (!Array.isArray(etapes) || !etapes.length) return null;
  const der = etapes.find((e) => e && e.derniere && e.fait) || null;
  const cours = etapes.find((e) => e && e.cours) || null;
  const e = der || cours;
  if (!e) return null;
  const nom = e.court || e.label || '';
  const jour = der && e.preuve !== 'deduite' ? jourCourt(e.t) : '';
  return { cle: e.cle, texte: jour ? `${nom} · ${jour}` : nom, ton: der ? '' : (e.ton || '') };
}

export default function Frise({ etapes, cle = '', label = 'Où en est-elle', className = '', inline = false }) {
  if (!Array.isArray(etapes) || !etapes.length) return null;
  const Liste = inline ? 'span' : 'ol';
  const Etape = inline ? 'span' : 'li';
  const leg = legendeFrise(etapes);
  return (
    <Liste className={'vrm-fu-frise' + (className ? ' ' + className : '')} data-fu-frise={cle} aria-label={label} role={inline ? 'list' : undefined}
      data-fu-n={etapes.length} style={{ '--fu-n': etapes.length }}>
      {etapes.map((e) => (
        <Etape key={e.cle} className="vrm-fu-seg" data-fu-etape={e.cle} data-fait={e.fait ? '1' : '0'} data-preuve={e.preuve || ''}
          data-cours={e.cours ? '' : undefined} data-ton={e.cours ? e.ton : undefined} data-derniere={e.derniere ? '' : undefined}
          aria-current={e.cours ? 'step' : undefined} role={inline ? 'listitem' : undefined}>
          <i aria-hidden="true" />
          <span className="vrm-fu-sr" title={e.court ? e.label : undefined}>{e.label}{e.fait ? ' : fait' : e.cours ? ' : en cours' : ' : à venir'}</span>
        </Etape>
      ))}
      {leg ? <Etape className="vrm-fu-legende" data-fu-legende={leg.cle} data-ton={leg.ton || undefined} aria-hidden="true" role={inline ? 'presentation' : undefined}>{leg.texte}</Etape> : null}
    </Liste>
  );
}
