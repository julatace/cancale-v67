// ── src/natif/Bouton.jsx — LE bouton du design natif (contrat NATIF.md §3) ───────────────
// Quatre variantes, aucune autre :
//   plein      LE geste de l'écran (UN par écran) : 50 de haut, toute la largeur, rayon 14.
//   teinte     un geste secondaire : fond --n-teinte, texte --n-sur-teinte.
//   texte      un geste discret : texte --n-accent, sans fond.
//   destructif un geste qu'on ne rattrape pas : il DEMANDE avant (un 2e toucher, 4 s pour le faire).
//              Jamais rouge : le rouge est réservé à deux paires sous un N° (CLAUDE.md §7).
// Props :
//   variante      'plein' | 'teinte' | 'texte' | 'destructif'   (défaut 'teinte')
//   icone         nœud (une icône de l'app), à gauche du libellé
//   chargement    vrai ⇒ roue à la place de l'icône, le bouton n'agit pas, la largeur ne bouge pas
//   indisponible  vrai ⇒ grisé LISIBLE, n'agit pas — passe toujours `raison`
//   raison        la phrase qui dit pourquoi (affichée sous le bouton, lue par le lecteur d'écran)
//   confirmation  (destructif) le libellé du 2e toucher, ex. « Supprimer pour de bon »
//   large         vrai ⇒ toute la largeur (un plein l'est d'office)
//   ajuste        (plein) vrai ⇒ le plein garde la largeur de son texte (un ancien écran qui le pose dans une barre)
//   ton           '' (défaut) | 'ambre' — un geste qu'on regrette (Retirer, Délier) sans la double confirmation du destructif
//   bloc          '' (défaut) | 'contenu' — l'enveloppe s'efface (display: contents) tant qu'aucune phrase n'est dessous :
//                 le bouton reste l'enfant direct de la mise en page d'un ancien écran (flex, grille)
//   taille        'normal' (défaut) | 'compact' — compact : 32 de haut à la SOURIS (un tableau, une barre d'outils),
//                 toujours 44 au doigt ; texte 15/600
//   onClick, type, className, attrs (data-*, aria-* en plus)
// FIABILITÉ (20 nov., chantier « boutons natifs ») — un geste réseau ne se double pas et dit son résultat :
//   · si `onClick` RENVOIE une promesse, le bouton passe « en cours » tout seul (roue, aria-busy) jusqu'à sa fin ;
//     pendant ce temps (et dès le 1er toucher, avant même le rendu) un 2e toucher ne fait RIEN : un double toucher =
//     un seul geste ;
//   · la promesse rend une phrase (chaîne) ⇒ elle s'affiche sous le bouton 4 s (lue par le lecteur d'écran) ;
//     elle échoue ⇒ son message (ou « Ça n'a pas marché. Réessaie. ») s'affiche, en ambre, jusqu'au prochain toucher.
// Exemple :
//   <Bouton variante="plein" icone={<Icon name="printer" size={20}/>} onClick={imprimer}>
//     Imprimer 3 bordereaux
//   </Bouton>
//   <Bouton variante="plein" indisponible raison="Aucun bordereau prêt : ils arrivent par e-mail.">Imprimer</Bouton>
//
// `BoutonIcone` : une icône seule, 44 × 44, toujours NOMMÉE (`libelle` = aria-label).
//   <BoutonIcone libelle="Scanner un colis" icone={<Icon name="scan" size={22}/>} onClick={scanner}/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';

const DELAI_CONFIRMATION = 4000;
const DELAI_RESULTAT = 4000;

// Le geste d'un bouton : un seul à la fois. `enCoursRef` bloque AVANT le rendu (deux touchers dans la même image).
// Rend { enCours, resultat, lancer } ; `lancer(fn, e)` appelle fn(e) et, si elle rend une promesse, tient l'état.
export function useGesteUnique() {
  const enCoursRef = React.useRef(false);
  const vivant = React.useRef(true);
  const minuteur = React.useRef(0);
  const [enCours, setEnCours] = React.useState(false);
  const [resultat, setResultat] = React.useState(null);   // { ton: 'ok' | 'echec', texte }
  React.useEffect(() => () => { vivant.current = false; clearTimeout(minuteur.current); }, []);
  const lancer = React.useCallback((fn, e) => {
    if (enCoursRef.current) { if (e && e.preventDefault) e.preventDefault(); return; }
    clearTimeout(minuteur.current); setResultat(null);
    let r;
    try { r = fn ? fn(e) : undefined; }
    catch (err) { setResultat({ ton: 'echec', texte: (err && err.message) || tr('natif.bouton.echec') }); return; }
    if (!r || typeof r.then !== 'function') return;
    enCoursRef.current = true; setEnCours(true);
    r.then((v) => {
      if (!vivant.current) return;
      if (typeof v === 'string' && v.trim()) { setResultat({ ton: 'ok', texte: v }); minuteur.current = setTimeout(() => { if (vivant.current) setResultat(null); }, DELAI_RESULTAT); }
    }, (err) => { if (vivant.current) setResultat({ ton: 'echec', texte: (err && typeof err.message === 'string' && err.message) || tr('natif.bouton.echec') }); })
      .finally(() => { enCoursRef.current = false; if (vivant.current) setEnCours(false); });
  }, []);
  return { enCours, resultat, lancer };
}

export function Bouton({ variante = 'teinte', icone = null, chargement = false, indisponible = false, raison = '', confirmation = '',
  large = false, ajuste = false, ton = '', bloc = '', taille = 'normal', onClick, type = 'button', className = '', attrs = null, children }) {
  const id = React.useId();
  const idResultat = React.useId();
  const [arme, setArme] = React.useState(false);
  const minuteur = React.useRef(0);
  const geste = useGesteUnique();
  React.useEffect(() => () => clearTimeout(minuteur.current), []);
  const destructif = variante === 'destructif';
  const occupe = chargement || geste.enCours;
  const bloque = indisponible || occupe;

  const toucher = (e) => {
    if (bloque) { e.preventDefault(); return; }
    if (destructif && !arme) {
      e.preventDefault();
      setArme(true);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => setArme(false), DELAI_CONFIRMATION);
      return;
    }
    if (destructif) { clearTimeout(minuteur.current); setArme(false); }
    if (onClick) geste.lancer(onClick, e);
  };

  const libelle = destructif && arme ? (confirmation || tr('natif.bouton.confirmer')) : children;
  return (
    <span className={cx('n-bouton-bloc', (large || (variante === 'plein' && !ajuste)) && 'n-bouton-bloc-large')}
      data-n-bloc={bloc === 'contenu' && !(indisponible && raison) && !geste.resultat ? 'contenu' : undefined}>
      <button
        type={type}
        className={cx('n-bouton', className)}
        data-n-variante={variante}
        data-n-ton={ton === 'ambre' ? 'ambre' : undefined}
        data-n-taille={taille === 'compact' ? 'compact' : undefined}
        data-n-arme={arme ? '1' : undefined}
        aria-disabled={bloque ? 'true' : undefined}
        aria-busy={occupe ? 'true' : undefined}
        aria-describedby={indisponible && raison ? id : (geste.resultat ? idResultat : undefined)}
        onClick={toucher}
        onBlur={destructif ? () => { clearTimeout(minuteur.current); setArme(false); } : undefined}
        {...(attrs || {})}
      >
        {occupe ? <span className="n-roue" aria-hidden="true"/> : (icone ? <span className="n-bouton-icone" aria-hidden="true">{icone}</span> : null)}
        <span className="n-bouton-libelle" aria-live={destructif ? 'polite' : undefined}>{libelle}</span>
      </button>
      {indisponible && raison ? <span className="n-bouton-raison" id={id} data-n-raison="">{raison}</span> : null}
      {!indisponible && geste.resultat ? <span className="n-bouton-raison" id={idResultat} role="status" data-n-resultat={geste.resultat.ton}>{geste.resultat.texte}</span> : null}
    </span>
  );
}

// `raison` (indisponible) : dite dans l'infobulle et au lecteur d'écran (une icône seule n'a pas la place d'une phrase).
export function BoutonIcone({ libelle, icone, onClick, pastille = null, actif = false, indisponible = false, raison = '', taille = 'normal', className = '', attrs = null }) {
  const geste = useGesteUnique();
  const occupe = geste.enCours;
  return (
    <button
      type="button"
      className={cx('n-bouton-icone-seule', className)}
      data-n-taille={taille === 'compact' ? 'compact' : undefined}
      aria-label={indisponible && raison ? libelle + ' — ' + raison : libelle}
      title={indisponible && raison ? raison : (geste.resultat ? geste.resultat.texte : libelle)}
      aria-pressed={actif ? 'true' : undefined}
      aria-disabled={indisponible || occupe ? 'true' : undefined}
      aria-busy={occupe ? 'true' : undefined}
      data-n-resultat={geste.resultat ? geste.resultat.ton : undefined}
      onClick={(e) => { if (indisponible || occupe) { e.preventDefault(); return; } if (onClick) geste.lancer(onClick, e); }}
      {...(attrs || {})}
    >
      <span className="n-bouton-icone" aria-hidden="true">{occupe ? <span className="n-roue"/> : icone}</span>
      {pastille}
    </button>
  );
}

export default Bouton;
