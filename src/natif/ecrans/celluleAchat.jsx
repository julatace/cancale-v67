// ── src/natif/ecrans/celluleAchat.jsx — la colonne « Achat » des tableaux de Ventes (20 nov.) ────────────────────────────
// Julien : « il y a la place pour mettre le bouton relier, fais un beau logo pour relier les articles ». Les deux maillons
// (`relier`, ICON_PATHS) : accent = à relier (le toucher ouvre l'atelier « Relier » sur CETTE vente) ; gris + « acheté 30 € »
// = reliée (le toucher montre l'achat, dans le même atelier). Rien n'est relié tout seul (§5) : c'est SON toucher.
import React from 'react';
import { tr } from '../../i18n/index.js';

// `a` = { relie, prix, ouvrir } ou null (hors Vinted : la cellule dit « — »).
export function celluleAchat(a, Icon) {
  if (!a) return null;
  const nom = a.relie ? tr('vt.achatRelie', { prix: a.prix || '—' }) : tr('vt.relier');
  return (
    <button type="button" className="n-vt-relier" data-vt-relier={a.relie ? 'relie' : 'libre'} aria-label={nom} title={nom}
      onClick={(e) => { e.stopPropagation(); a.ouvrir(); }} onKeyDown={(e) => e.stopPropagation()}>
      <span className="n-vt-relier-rond" aria-hidden="true">{Icon ? <Icon name="relier" size={18}/> : null}</span>
      {a.relie && a.prix ? <span className="n-vt-relier-prix">{tr('vt.achetePrix', { prix: a.prix })}</span> : null}
    </button>
  );
}

