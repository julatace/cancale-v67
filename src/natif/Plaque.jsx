// ── src/natif/Plaque.jsx — le N° de rangement, tel qu'il est écrit sur le carton ─────────
// Props :
//   numero    le N° (« 124 », « B230 », 1234) — affiché tel quel, jamais formaté (pas de séparateur de milliers)
//   doublon   vrai ⇒ ROUGE : deux paires présentes sous ce N° (le seul rouge de l'app, CLAUDE.md §7)
//   grand     vrai ⇒ 17/22 (la fiche) ; sinon 13/18 (une rangée)
// Un N° absent ne dessine rien : mieux vaut un blanc qu'un faux (CLAUDE.md §5).
// Exemple :
//   <Plaque numero={124}/>     <Plaque numero="B230" grand/>     <Plaque numero={88} doublon/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';

export function Plaque({ numero, doublon = false, grand = false, className = '' }) {
  if (numero == null || numero === '') return null;
  const n = String(numero);
  return (
    <span
      className={cx('n-plaque', grand && 'n-plaque-grand', className)}
      data-n-doublon={doublon ? '1' : undefined}
      aria-label={doublon ? tr('natif.plaque.doublon', { numero: n }) : tr('natif.plaque.numero', { numero: n })}
      role="img"
    >
      <span className="n-plaque-prefixe" aria-hidden="true">{tr('natif.plaque.prefixe')}</span>
      <span className="n-plaque-numero" aria-hidden="true">{n}</span>
    </span>
  );
}

export default Plaque;
