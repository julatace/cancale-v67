// ═══════════════════════════════════════════════════════════════════════════
// LA LIGNE « CE QU'ON SAIT » D'UN ACHAT, SOUS SON TITRE (17 nov., lot relier-taille)
// ═══════════════════════════════════════════════════════════════════════════
// Partout où il relie un achat (feuille « Relier un achat », Relier achats et ventes, colis à relier) : la TAILLE
// d'abord (lue chez Vinted, sinon écrite dans le titre — dit), puis l'état, les couleurs écrites, la marque nommée,
// la date, le vendeur. Ce qui correspond à l'article visé est marqué « ✓ même taille », ce qui diffère « ≠ 42 » —
// en encre neutre (aucune couleur d'accent, §7) ; rien n'est relié ni caché par ce marquage (§5).
// Règles : src/faitsAchat.js. Pas su ⇒ rien (jamais deviné).
import React from 'react';
import { tr } from './i18n/index.js';
import { faitsAchat } from './faitsAchat.js';
import './styles-faits-achat.css';

const COULEURS_DITES = new Set(['noir', 'blanc', 'gris', 'bleu', 'vert', 'rouge', 'rose', 'jaune', 'orange', 'violet', 'beige', 'marron']);

export function FaitsAchat({ achat, details = null, cible = null, marqueDe = null, couleursDe = null, date = '', compte = '', avant = null, className = '' }) {
  const f = faitsAchat(achat, { details, cible, marqueDe, couleursDe });
  const couleurs = f.couleurs.filter((c) => COULEURS_DITES.has(c)).map((c) => tr(`liaison.couleur.${c}`)).filter(Boolean);
  const reste = [f.etat, couleurs.join(' / '), f.marque, date, compte, f.vendeur ? tr('faits.vendeur', { vendeur: f.vendeur }) : ''].filter(Boolean);
  const tx = String((achat && achat.transaction_id) || '');
  return (
    <span className={`vrm-faits ${className}`.trim()} data-faits-achat={tx} data-faits-lu={f.lu ? '1' : '0'}>
      {avant ? <span className="vrm-faits-morceau">{avant}</span> : null}
      {f.taille ? (
        <span className={`vrm-faits-taille${f.accord ? ` is-${f.accord}` : ''}`} data-relier-taille={f.taille} data-taille-source={f.tailleSource} data-taille-accord={f.accord || undefined}
          aria-label={f.accord === 'meme' ? tr('faits.memeAria', { taille: f.taille }) : f.accord === 'diff' ? tr('faits.diffAria', { taille: f.taille, visee: f.tailleVisee }) : undefined}>
          {f.accord === 'meme' ? <span className="vrm-faits-coche" aria-hidden="true">✓</span> : null}
          {tr(f.tailleSource === 'titre' ? 'faits.tailleTitre' : 'faits.taille', { taille: f.taille })}
          {f.accord === 'diff' ? <span className="vrm-faits-diff" aria-hidden="true">{tr('faits.diff', { visee: f.tailleVisee })}</span> : null}
        </span>
      ) : null}
      {reste.map((x, i) => <span key={i} className="vrm-faits-morceau">{x}</span>)}
    </span>
  );
}

// La phrase dite UNE fois en tête d'une liste : combien d'achats n'ont pas de taille lue, et d'où elle viendra.
export function NoteTailleAchats({ n, className = '' }) {
  if (!n) return null;
  return <p className={`vrm-faits-note ${className}`.trim()} data-faits-sans-taille={n}>{tr('faits.sansTailleLue', { n })}</p>;
}
