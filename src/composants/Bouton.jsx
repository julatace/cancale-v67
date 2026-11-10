// ═══════════════════════════════════════════════════════════════════════════
// LE BOUTON ET LE SEGMENTÉ — une forme par rôle (29 oct., complétés le 5 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Le dessin de base vit dans src/styles-boutons.css (.vrm-b-*) ; les deux
// ajouts du 5 nov. (revue de cohérence 1.9-1.10, chantier B) dans
// src/styles-composants.css :
//   · variante « danger » = AMBRE (§7 : le rouge n'appartient qu'à deux articles
//     sous un même N°) — Supprimer, Délier, Retirer ;
//   · taille « petit » : 32 px à la souris, 44 px au doigt (jamais moins).
// Variantes : primaire (UNE par écran, fond accent) · secondaire (fond teinté,
// aucune bordure) · discret (lien-action, zone 44 px) · danger (ambre teinté).
// `href` ⇒ un <a>. `occupe` ⇒ grisé + aria-busy (une lecture en cours) ; tout
// le reste (data-*, title, disabled, aria-*) passe tel quel : un bouton grisé
// garde sa raison dans `title`, il n'est jamais caché.
// `rendreIcone(nom)` : App.jsx y branche son `Icon` (ICON_PATHS) ; hors de
// l'app (banc), les icônes des composants (icones.jsx).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { IconeComposant } from './icones.jsx';

const iconeParDefaut = (nom, taille) => <IconeComposant nom={nom} taille={taille}/>;

export const VARIANTES_BOUTON = Object.freeze(['primaire', 'secondaire', 'discret', 'danger']);

// (10 nov., lot P — VoiceOver) Un bouton en ICÔNE SEULE n'a pas de texte : sans nom, le
// lecteur d'écran dit « bouton », rien d'autre. Son nom, dans l'ordre : `aria-label` /
// `aria-labelledby` posés par l'écran, puis son `title` (l'infobulle dit déjà le geste),
// puis le nom de l'icône ci-dessous. Une icône absente d'ici et sans titre : « Bouton » —
// et `audit-raccourcis-clavier.cjs` refuse un `<Bouton icone=…>` sans texte ni nom dans src/.
export const NOMS_ICONES = Object.freeze({
  close: 'Fermer', search: 'Chercher', gear: 'Réglages', trash: 'Supprimer', pencil: 'Modifier', sync: 'Relire',
  printer: 'Imprimer', copy: 'Copier', filter: 'Filtrer', more: 'Plus d’actions', menu: 'Menu', chevron: 'Ouvrir',
  help: 'Aide', info: 'En savoir plus', eye: 'Montrer', eyeOff: 'Cacher', camera: 'Photo', mic: 'Dicter',
  bell2: 'Notifications', link: 'Lien', mail: 'E-mail', chat: 'Messages', check: 'Valider', heart: 'Favoris',
  send: 'Envoyer', save: 'Enregistrer', restore: 'Restaurer', scan: 'Scanner', qr: 'Code QR', calendar: 'Calendrier',
  play: 'Lire', archive: 'Archiver', image: 'Image', doc: 'Document', moon: 'Mode sombre', sun: 'Mode clair',
});
export const nomBoutonIcone = (icone, rest = {}) => {
  if (!icone || rest['aria-label'] || rest['aria-labelledby']) return null;
  if (typeof rest.title === 'string' && rest.title.trim()) return rest.title.trim();
  return NOMS_ICONES[icone] || 'Bouton';
};

export function BoutonBase({ variante = 'secondaire', taille, icone, plein = false, occupe = false, disabled = false, className = '', children, type = 'button', href, rendreIcone = iconeParDefaut, ...rest }) {
  const v = VARIANTES_BOUTON.includes(variante) ? variante : 'secondaire';
  const cls = `vrm-b vrm-b-${v}${taille === 'petit' ? ' vrm-b-petit' : ''}${plein ? ' vrm-b-plein' : ''}${!children && icone ? ' vrm-b-icone' : ''}${className ? ' ' + className : ''}`;
  const ic = icone ? rendreIcone(icone, taille === 'petit' ? 16 : 18) : null;
  const contenu = <>{occupe?<svg className="vrm-b-indicateur" aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="7" opacity=".25"/><path d="M10 3a7 7 0 0 1 7 7" strokeLinecap="round"/></svg>:ic || null}{children}</>;
  const bloque=occupe||disabled;
  const nomIcone = !children && icone ? nomBoutonIcone(icone, rest) : null;
  const occ = { ...(occupe ? { 'aria-busy': 'true', disabled: true } : {}), ...(nomIcone ? { 'aria-label': nomIcone } : {}) };
  if (href) return <a href={bloque ? undefined : href} className={cls} {...rest} {...(nomIcone ? { 'aria-label': nomIcone } : {})} {...(bloque ? { role: 'link', tabIndex: -1, 'aria-busy': occupe ? 'true' : undefined, 'aria-disabled': 'true', onClick: e => e.preventDefault(), onAuxClick: e => e.preventDefault() } : {})}>{contenu}</a>;
  // Type écrit en clair (audit-commandes) : « submit » seulement quand on le
  // demande, sinon « button » — jamais un envoi de formulaire par défaut.
  if (type === 'submit') return <button type="submit" disabled={disabled} className={cls} {...rest} {...occ}>{contenu}</button>;
  return <button type="button" disabled={disabled} className={cls} {...rest} {...occ}>{contenu}</button>;
}

// UN contrôle segmenté pour toute l'app (revue du 16 oct.). Le dessin vit dans
// `.vrm-seg` (styles-coque.css — sa règle unique est le chantier A).
// options : [{ v, l, icone?, n?, titre?, disabled?, data? }]
//   · `titre` : infobulle et nom lu — OBLIGATOIRE quand `l` est vide (segment
//     en icône seule, ex. le sélecteur de sites) ;
//   · `n` : un compte posé après le libellé (« À envoyer 3 ») ;
//   · `data` : les data-* que lisent les bancs.
// Un CHOIX d'écran pose aria-pressed ; les sous-onglets gardent aria-current (PlatSubNav).
export function SegmenteBase({ label, options, value, onChange, plein = false, disabled = false, className = '', style, rendreIcone = iconeParDefaut }) {
  return (
    <div role="group" aria-label={label} className={`vrm-seg${plein ? ' vrm-seg-plein' : ''}${className ? ' ' + className : ''}`} style={style}>
      {options.map(o => (
        <button key={o.v} type="button" className="vrm-seg-btn" aria-pressed={value === o.v}
          disabled={disabled || !!o.disabled} onClick={() => onChange(o.v)}
          {...(o.titre ? { title: o.titre, ...(o.l ? {} : { 'aria-label': o.titre }) } : (!o.l && o.icone ? { 'aria-label': NOMS_ICONES[o.icone] || String(o.v) } : {}))} {...(o.data || {})}>
          {o.icone ? rendreIcone(o.icone, 15) : null}
          {o.l}
          {o.n===0||o.n ? <span className="vrm-seg-n"> {o.n}</span> : null}
        </button>
      ))}
    </div>
  );
}
