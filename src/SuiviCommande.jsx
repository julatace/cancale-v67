// ─────────────────────────────────────────────────────────────────────────────
// (11 nov., lot `suivi-commandes`) LE SUIVI D'UNE COMMANDE EN COURS, sur sa carte.
// Julien : « intègre les numéros de suivi sur les commandes en cours, comme ça tu
// regardes leur statut pour voir la cohérence ».
//
// Une carte de Ventes (Envoyés, À envoyer) ou d'Achats (en route) y gagne :
//   · le n° de suivi, COPIABLE d'un tap, et « Suivre ↗ » (la page publique) ;
//   · le DERNIER statut lu, sa source et l'heure (« En transit · Vannes ·
//     hier 18:02 — lu chez Chronopost il y a 2 h ») ;
//   · une incohérence PROUVÉE, en ambre : une phrase, puis UN geste.
// La règle vit dans api/_lib/suivi-commandes.js (pure) ; ici, rien que l'affichage.
// `sansStatut` : seulement le n°, le lien et l'incohérence.
// Aucun statut lu ⇒ on le dit (« Statut pas encore lu »), jamais deviné.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function SuiviCommande({ C, suivi, lien = null, statut = null, incoherences = [], raison = '', cle = '', toast = null, sansStatut = false }) {
  const [copie, setCopie] = React.useState(false);
  if (!suivi) return null;
  const inc = Array.isArray(incoherences) ? incoherences : [];
  const copier = async () => {
    try { await navigator.clipboard.writeText(suivi); setCopie(true); setTimeout(() => setCopie(false), 1500); }
    catch (_) { if (toast) toast('Copie impossible ici'); }
  };
  const bouton = { minHeight: 44, padding: '0 12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' };
  return (
    <div className="vrm-suivi-commande" data-suivi-commande={cle || suivi} data-suivi-n={suivi}
      data-suivi-source={statut ? statut.source : 'aucune'} data-suivi-etat={(statut && statut.etat) || ''} data-suivi-incoherences={inc.length}
      data-suivi-incoherence={inc.map((x) => x.code).join(' ') || undefined}
      style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={copier} data-suivi-copier={suivi} aria-label={`Copier le n° de suivi ${suivi}`} title="Copier le n° de suivi"
          style={{ ...bouton, flex: '1 1 160px', maxWidth: 380, minWidth: 0, justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: 0.2 }}>N° {suivi}</span>
          <span data-suivi-copie={copie ? '1' : '0'} style={{ color: copie ? C.text : C.muted, fontWeight: 500, fontSize: 12 }}>{copie ? 'Copié ✓' : 'Copier'}</span>
        </button>
        {lien ? <a href={lien.url} target="_blank" rel="noreferrer" data-suivi-lien={lien.site ? 'transporteur' : 'recherche'} style={bouton}
          aria-label={lien.site ? 'Suivre chez le transporteur' : 'Chercher ce n° de suivi'}>{lien.site ? 'Suivre ↗' : 'Chercher ↗'}</a> : null}
      </div>
      {/* `sansStatut` : la carte dit déjà ce que lit le transporteur (Achats, `LigneTransporteur`) — pas deux fois (§7). */}
      {sansStatut ? null : <div data-suivi-statut="" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.4, color: C.text }}>
        {statut
          ? <><span data-suivi-texte="" style={{ fontWeight: 600 }}>{statut.texte}</span><span data-suivi-lu="" style={{ color: C.muted }}>{' — '}{statut.sourceTexte}</span></>
          : <span data-suivi-texte="" style={{ color: C.muted }}>{raison || 'Statut pas encore lu.'}</span>}
      </div>}
      {inc.map((x) => (
        <div key={x.code} className="vrm-suivi-incoherence" data-incoherence={x.code}
          style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: `${C.warn}14`, border: `1px solid ${C.warn}55`, fontSize: 13, lineHeight: 1.4, color: C.text }}>
          <div data-incoherence-texte="">{x.texte}</div>
          <div data-incoherence-geste="" style={{ marginTop: 2, fontWeight: 600, color: C.warn }}>{x.geste}</div>
        </div>
      ))}
    </div>
  );
}
