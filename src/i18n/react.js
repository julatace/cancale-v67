// Le lien React de la traduction : `useLangue()` rend la langue courante et
// redessine le composant quand elle change (src/i18n/index.js).
// La racine (src/main.jsx) l'appelle : tout l'arbre se redessine au changement ;
// un composant mémorisé (React.memo, useMemo d'un libellé) l'appelle lui-même.
import React from 'react';
import { abonnerLangue, langueCourante } from './index.js';
export function useLangue() {
  return React.useSyncExternalStore(abonnerLangue, langueCourante, langueCourante);
}
