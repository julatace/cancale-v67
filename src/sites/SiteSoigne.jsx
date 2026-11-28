// ════════════════════════════════════════════════════════════════════════════
// LES PAGES DES SITES, SOIGNÉES (28 nov. 2026). Julien : « je veux que tu améliores même Vestiaire Collective,
// Leboncoin et eBay ; pour eBay je veux que tu fasses tout parfaitement comme la page de connexion ».
//
// La page de connexion eBay (src/ebay/ConnexionEbayGuidee.jsx) est la RÉFÉRENCE : un titre net, ce qui va se passer
// en étapes numérotées dans des pastilles teintées, UN bouton plein, une note courte. Ces deux pièces portent la même
// recette sur chaque page de Leboncoin, de Vestiaire et d'eBay (§2.11 : mêmes informations, mêmes gestes partout) :
//
//  • `TeteSite`  : la tête d'une page de site — le logo du site sur sa tuile, le titre de la page, UNE ligne qui dit à
//                  quoi elle sert (`data-site-tete`). La même forme sur les trois sites ; seul le logo change.
//  • `EtatSite`  : un état sans contenu (jamais relevé, vide, panne) dit comme la page de connexion — tuile du logo,
//                  titre, étapes numérotées (ou une phrase), UN geste, une note courte. Jamais un texte nu.
//
// Affichage SEULEMENT : aucune règle de données ne passe ici. Tout texte par tr() (clés `ss.*`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { LogoSite } from '../natif/LogoSite.jsx';
import { Bouton } from '../natif/Bouton.jsx';
import './site-soigne.css';

const NOMS = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
export const nomSite = (site) => NOMS[site] || '';

// La tuile du logo : la marque reconnue d'un coup d'œil, posée sur une surface calme.
export function TuileSite({ site, taille = 40 }) {
  return (
    <span className="ss-tuile" data-ss-site={site} data-ss-taille={taille} aria-hidden="true">
      <LogoSite site={site} taille={taille >= 44 ? 20 : 18}/>
    </span>
  );
}

// `section` : la page (ventes, annonces, messages, achats, tableau, agent, offres, argent, sante, trafic, promo…).
// Le titre et la ligne viennent de `ss.tete.<section>` (« {site} » remplacé par le nom du site).
export function TeteSite({ site, section, titre = '', ligne = null, droite = null }) {
  const nom = nomSite(site);
  if (!nom) return null;
  const t = titre || tr('ss.tete.' + section, { site: nom });
  const l = ligne != null ? ligne : tr('ss.tete.' + section + '.ligne', { site: nom });
  return (
    <header className="ss-tete" data-site-tete={site} data-ss-section={section}>
      <TuileSite site={site}/>
      <span className="ss-tete-textes">
        <span className="ss-tete-titre">{t}</span>
        {l ? <span className="ss-tete-ligne">{l}</span> : null}
      </span>
      {droite ? <span className="ss-tete-droite">{droite}</span> : null}
    </header>
  );
}

// `etapes` : tableau de textes (2 à 4) ; `phrase` : une ligne quand il n'y a pas d'étapes.
// `action` : { libelle, onClick } ou { libelle, href } (ouvert dans un nouvel onglet) — UN plein.
// `secondaire` : { libelle, onClick } — un geste à la forme d'un lien (jamais un 2e plein).
// `sorte` : 'vide' | 'jamais' | 'panne' (posé en data-, pour les bancs).
export function EtatSite({ site, titre, etapes = null, phrase = '', action = null, secondaire = null, note = '', sorte = 'vide', attrs = null }) {
  const ouvrir = (a) => () => {
    if (a.onClick) return a.onClick();
    if (a.href) { try { window.open(a.href, '_blank', 'noopener,noreferrer'); } catch (_) {} }
    return undefined;
  };
  return (
    <section className="ss-etat" data-ss-etat={sorte} data-ss-site={site} {...(attrs || {})}>
      <TuileSite site={site} taille={44}/>
      <h3 className="ss-etat-titre">{titre}</h3>
      {Array.isArray(etapes) && etapes.length ? (
        <ol className="ss-etapes">
          {etapes.map((e, i) => (
            <li key={i} className="ss-etape" data-ss-etape={i + 1}>
              <span className="ss-etape-n" aria-hidden="true">{i + 1}</span>
              <span className="ss-etape-texte">{e}</span>
            </li>
          ))}
        </ol>
      ) : phrase ? <p className="ss-etat-phrase">{phrase}</p> : null}
      {action || secondaire ? (
        <div className="ss-etat-gestes">
          {action ? <Bouton variante="plein" ajuste onClick={ouvrir(action)} attrs={action.attrs || null}>{action.libelle}</Bouton> : null}
          {secondaire ? <Bouton variante="texte" onClick={ouvrir(secondaire)} attrs={secondaire.attrs || null}>{secondaire.libelle}</Bouton> : null}
        </div>
      ) : null}
      {note ? <p className="ss-etat-note">{note}</p> : null}
    </section>
  );
}

export default TeteSite;
