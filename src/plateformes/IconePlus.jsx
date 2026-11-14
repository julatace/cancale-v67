// ── src/plateformes/IconePlus.jsx — le « + » des barres de liste (publier, vendre, ajouter) ──
// `ICON_PATHS` n'a pas de « + » : il est dessiné ici, au trait des autres icônes (1,8 px, bouts ronds).
import React from 'react';
export function IconePlus({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>;
}
export default IconePlus;
