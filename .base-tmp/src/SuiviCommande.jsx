// ─────────────────────────────────────────────────────────────────────────────
// (11 nov., lot `suivi-commandes`) LE SUIVI D'UNE COMMANDE EN COURS, sur sa carte.
// Julien : « intègre les numéros de suivi sur les commandes en cours, comme ça tu
// regardes leur statut pour voir la cohérence ».
//
// (11 nov., soir) Le premier dessin (un bloc : bouton du n°, « Suivre ↗ », statut sur deux lignes, sous une
// puce grise pleine largeur côté Achats) est REMPLACÉ par la ligne compacte ci-dessous (`LigneSuivi`).
// Une carte de Ventes (Envoyés, À envoyer) ou d'Achats y gagne :
//   · le n° de suivi, COPIABLE d'un tap, et « Suivre ↗ » (la page publique) ;
//   · le DERNIER statut lu, sa source et l'heure (« En transit · Vannes ·
//     hier 18:02 — lu chez Chronopost il y a 2 h ») ;
//   · une incohérence PROUVÉE, en ambre : une phrase, puis UN geste.
// La règle vit dans api/_lib/suivi-commandes.js (pure) ; ici, rien que l'affichage.
// `sansStatut` : seulement le n°, le lien et l'incohérence.
// Aucun statut lu ⇒ on le dit (« Statut pas encore lu »), jamais deviné.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import './design/suivi-ligne.css';

// ─────────────────────────────────────────────────────────────────────────────
// (11 nov., soir) LA LIGNE DE SUIVI COMPACTE — Julien, sur une capture de production
// (Achats, ordinateur) : « c'est nul, le logo prend toute la page, c'est moche, je
// veux que tout soit mieux ; si tu peux mettre le numéro de suivi à côté de chaque
// achat ce serait top ». Avant : une puce grise pleine largeur, le logo centré, puis
// la phrase du transporteur sur trois lignes.
// Maintenant UNE ligne (≤ 24 px), 13 px gris :
//   [logo 18 px] Mondial Relay · N° 12345678 ↗ · Pris en charge · Lieusaint · il y a 47 min  ›
// · le n° se copie d'un tap (la cible fait 44 px au doigt, le dessin reste fin) ;
// · « ↗ » ouvre la page publique du transporteur ;
// · « › » déplie le détail (la phrase exacte du transporteur, sa source) ;
// · une incohérence PROUVÉE reste dite dessous, en ambre (phrase + geste).
// Le n° vient de l'appelant, par une identité prouvée (§5) ; sans n°, rien.
// ─────────────────────────────────────────────────────────────────────────────
export function LigneSuivi({ C, cle = '', suivi, logo = null, nom = '', lien = null, court = '', quand = '', detail = null, incoherences = [], toast = null, source = '', etat = '' }) {
  const [copie, setCopie] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(false);
  if (!suivi) return null;
  const inc = Array.isArray(incoherences) ? incoherences : [];
  const copier = async (e) => {
    if (e) e.stopPropagation();
    try { await navigator.clipboard.writeText(suivi); setCopie(true); setTimeout(() => setCopie(false), 1500); }
    catch (_) { if (toast) toast('Copie impossible ici'); }
  };
  return (
    <div className="vrm-suivi-ligne" data-suivi-commande={cle || suivi} data-suivi-n={suivi} data-suivi-ligne=""
      data-suivi-source={source || 'aucune'} data-suivi-etat={etat || ''} data-suivi-incoherences={inc.length}
      data-suivi-incoherence={inc.map((x) => x.code).join(' ') || undefined} style={{ '--sl-gris': C.muted, '--sl-encre': C.text }}>
      <div className="vrm-sl-rang">
        {logo ? <span className="vrm-sl-logo">{logo}</span> : null}
        {nom ? <span className="vrm-sl-nom">{nom}</span> : null}
        <button type="button" className="vrm-sl-n" onClick={copier} data-suivi-copier={suivi} aria-label={`Copier le n° de suivi ${suivi}`} title="Copier le n° de suivi">
          <span data-suivi-copie={copie ? '1' : '0'}>{copie ? 'Copié ✓' : `N° ${suivi}`}</span>
        </button>
        {lien ? <a className="vrm-sl-lien" href={lien.url} target="_blank" rel="noreferrer" data-suivi-lien={lien.site ? 'transporteur' : 'recherche'}
          aria-label={lien.site ? 'Suivre chez le transporteur' : 'Chercher ce n° de suivi'} title={lien.site ? 'Suivre chez le transporteur' : 'Chercher ce n° de suivi'} onClick={(e) => e.stopPropagation()}>↗</a> : null}
        {court ? <span className="vrm-sl-statut" data-suivi-texte="">{court}</span> : null}
        {quand ? <span className="vrm-sl-quand" data-suivi-lu="">{quand}</span> : null}
        {detail ? <button type="button" className="vrm-sl-plus" aria-expanded={ouvert} aria-label={ouvert ? 'Masquer le détail du suivi' : 'Voir le détail du suivi'}
          data-suivi-deplier="" onClick={(e) => { e.stopPropagation(); setOuvert((o) => !o); }}>{ouvert ? '‹' : '›'}</button> : null}
      </div>
      {ouvert && detail ? <div className="vrm-sl-detail" data-suivi-detail="">{quand ? <span className="vrm-sl-detail-quand">{quand} · </span> : null}{detail}</div> : null}
      {inc.map((x) => (
        <div key={x.code} className="vrm-suivi-incoherence" data-incoherence={x.code}
          style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: `${C.warn}14`, border: `1px solid ${C.warn}55`, fontSize: 13, lineHeight: 1.4, color: C.text }}>
          <span data-incoherence-texte="">{x.texte}</span>{' '}
          <b data-incoherence-geste="" style={{ fontWeight: 600, color: C.warn }}>{x.geste}</b>
        </div>
      ))}
    </div>
  );
}
