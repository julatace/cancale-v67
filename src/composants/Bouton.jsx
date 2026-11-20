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
import { Bouton, BoutonIcone } from '../natif/Bouton.jsx';
import { Segmente } from '../natif/Segmente.jsx';

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

// (20 nov., chantier « boutons natifs ») BoutonBase DESSINE LE BOUTON NATIF (src/natif/Bouton.jsx, NATIF.md §3) :
// les 300 et quelques `<Bouton>` des anciens écrans prennent d'un coup la forme, les états (appui −8 %, focus, roue,
// indisponible AVEC sa raison) et la fiabilité (un geste qui rend une promesse ne se double pas) du design natif.
//   primaire → plein (sa largeur gardée, sauf `plein`) · secondaire → teinte · discret → texte · danger → texte AMBRE
//   (un clic, comme avant : la confirmation, quand il en faut une, reste celle de l'écran) ; `taille="petit"` → compact
//   (32 à la souris, 44 au doigt) ; icône 20 ; `occupe` → chargement ; `disabled` → indisponible, sa raison = `title`
//   (ou `data-raison`) DITE sous le bouton ; une icône seule → BoutonIcone (44, nommée) ; `href` → un <a> au dessin natif.
const VERS_NATIF = { primaire: 'plein', secondaire: 'teinte', discret: 'texte', danger: 'texte' };
export function BoutonBase({ variante = 'secondaire', taille, icone, plein = false, occupe = false, disabled = false, className = '', children, type = 'button', href, rendreIcone = iconeParDefaut, onClick, ...rest }) {
  const v = VARIANTES_BOUTON.includes(variante) ? variante : 'secondaire';
  const vn = VERS_NATIF[v];
  const compact = taille === 'petit';
  const ic = icone ? rendreIcone(icone, 20) : null;
  const nomIcone = !children && icone ? nomBoutonIcone(icone, rest) : null;
  const raison = disabled ? String(rest.title || rest['data-raison'] || '') : '';
  const attrs = { 'data-vrm-variante': v, ...rest };
  if (href) {
    const bloque = occupe || disabled;
    return <a href={bloque ? undefined : href} className={'n-bouton' + (className ? ' ' + className : '')} data-n-variante={vn} data-n-ton={v === 'danger' ? 'ambre' : undefined}
      data-n-taille={compact ? 'compact' : undefined} onClick={onClick} {...attrs} {...(nomIcone ? { 'aria-label': nomIcone } : {})}
      {...(bloque ? { role: 'link', tabIndex: -1, 'aria-busy': occupe ? 'true' : undefined, 'aria-disabled': 'true', onClick: e => e.preventDefault(), onAuxClick: e => e.preventDefault() } : {})}>
      {ic ? <span className="n-bouton-icone" aria-hidden="true">{ic}</span> : null}{children ? <span className="n-bouton-libelle">{children}</span> : null}</a>;
  }
  if (nomIcone) {
    return <BoutonIcone libelle={rest['aria-label'] || nomIcone} icone={occupe ? <span className="n-roue"/> : ic} onClick={onClick} indisponible={disabled || occupe} raison={raison}
      taille={compact ? 'compact' : 'normal'} className={className} attrs={{ ...attrs, 'aria-busy': occupe ? 'true' : undefined }}/>;
  }
  return <Bouton variante={vn} ton={v === 'danger' ? 'ambre' : ''} ajuste={!plein} large={plein} bloc="contenu" taille={compact ? 'compact' : 'normal'}
    icone={ic} chargement={occupe} indisponible={disabled} raison={raison} type={type === 'submit' ? 'submit' : 'button'} className={className} onClick={onClick} attrs={attrs}>{children}</Bouton>;
}

// UN contrôle segmenté pour toute l'app (revue du 16 oct.). Le dessin vit dans
// `.vrm-seg` (styles-coque.css — sa règle unique est le chantier A).
// options : [{ v, l, icone?, n?, titre?, disabled?, data? }]
//   · `titre` : infobulle et nom lu — OBLIGATOIRE quand `l` est vide (segment
//     en icône seule, ex. le sélecteur de sites) ;
//   · `n` : un compte posé après le libellé (« À envoyer 3 ») ;
//   · `data` : les data-* que lisent les bancs.
// Un CHOIX d'écran pose aria-pressed ; les sous-onglets gardent aria-current (PlatSubNav).
// (20 nov., chantier « boutons natifs ») SegmenteBase DESSINE LE SEGMENTÉ NATIF (src/natif/Segmente.jsx : une piste, le
// curseur qui glisse, ← → au clavier) — plus de puces faites main. aria-pressed reste posé (les bancs d'hier désignent le
// choix par lui) ; un segment indisponible ne part pas (aria-disabled) ; un 0 ne s'écrit pas (un compte discret).
export function SegmenteBase({ label, options, value, onChange, plein = false, disabled = false, className = '', style, rendreIcone = iconeParDefaut }) {
  const choisir = (cle) => { if (disabled) return; const o = options.find((x) => x.v === cle); if (!o || o.disabled) return; onChange(cle); };
  return (
    <Segmente libelle={label} valeur={value} onChange={choisir} className={'vrm-seg-natif' + (plein ? ' vrm-seg-natif-plein' : '') + (className ? ' ' + className : '')}
      options={options.map((o) => ({
        cle: o.v,
        libelle: o.icone ? <>{rendreIcone(o.icone, 15)}{o.l}</> : o.l,
        n: o.n === 0 || o.n ? o.n : null,
        attrs: {
          'aria-pressed': value === o.v ? 'true' : 'false',
          ...(o.titre ? { title: o.titre, ...(o.l ? {} : { 'aria-label': o.titre }) } : (!o.l && o.icone ? { 'aria-label': NOMS_ICONES[o.icone] || String(o.v) } : {})),
          ...(disabled || o.disabled ? { 'aria-disabled': 'true' } : {}),
          ...(o.data || {}),
        },
      }))}/>
  );
}
