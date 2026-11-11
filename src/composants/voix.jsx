// ═══════════════════════════════════════════════════════════════════════════
// PARLER À LA LOUPE (11 nov.) — ce qui s'affiche pendant la dictée.
// ═══════════════════════════════════════════════════════════════════════════
// `useEtatVoix(canal)` : { ecoute, direct, erreur } du moteur (src/dicteeNavigateur.js).
// `LigneVoix` : la ligne de la loupe — « J'écoute… », puis ce qui est entendu EN
// DIRECT, ou la phrase de l'erreur (micro refusé : que faire). Le « Pourquoi ? »
// dit que la voix est reconnue par le navigateur, pas par VRM.
import React from 'react';
import { etatVoix, ecouterEtatVoix, PHRASES_VOIX, POURQUOI_VOIX, VOIX, voixDisponible } from '../dicteeNavigateur.js';

export function useEtatVoix(canal) {
  const [, rafraichir] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => ecouterEtatVoix((c) => { if (c === canal) rafraichir(); }), [canal]);
  return etatVoix(canal);
}

// `Pourquoi` est celui de l'app (passé par la coque : il vit dans App.jsx).
export function LigneVoix({ canal = 'loupe', Pourquoi, vide = false, mobile = false, couleur }) {
  const e = useEtatVoix(canal);
  if (!voixDisponible()) return null;
  const pq = Pourquoi ? <Pourquoi titre="La recherche à la voix">{POURQUOI_VOIX}</Pourquoi> : null;
  const style = { padding: '6px 2px 0', fontSize: 12, lineHeight: 1.45, color: couleur || 'inherit', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' };
  if (e.ecoute) {
    return <div data-voix-ecoute="1" data-voix-direct={e.direct || ''} role="status" aria-live="polite" style={style}>
      <span>{e.direct ? <>J’entends : « <strong data-voix-entendu="">{e.direct}</strong> »</> : 'J’écoute… dis un N° (« cent vingt-quatre », « B 125 ») ou des mots (« Nike rouge 42 »).'}</span>{pq}
    </div>;
  }
  const code = e.erreur || (VOIX.refus ? 'refus' : null);
  if (code) return <div data-voix-erreur={code} role="status" style={style}><span>{PHRASES_VOIX[code] || PHRASES_VOIX.autre}</span>{pq}</div>;
  if (!vide) return null;
  return <div data-voix-aide="" style={style}><span>{mobile ? 'À la voix : touche le micro (ou garde le doigt sur la loupe) et dis un N° ou des mots.' : 'À la voix : touche le micro et dis un N° (« cent vingt-quatre ») ou des mots (« Nike rouge 42 »).'}</span>{pq}</div>;
}
