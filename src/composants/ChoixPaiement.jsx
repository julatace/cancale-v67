// « Payé en : Espèces · Carte · Virement · Chèque · Autre » (11 nov., lot livre-registre).
// Facultatif : rien de choisi par défaut, un second toucher sur le choix actif l'enlève.
// Partagé par « Nouvel achat » hors plateforme (écran Achats) et l'achat en gros (Fournisseurs).
import React from 'react';
import { tr } from '../i18n/index.js';
import { MODES_PAIEMENT, modePaiementLu } from '../modePaiement.js';

export default function ChoixPaiement({ value, onChange, C }) {
  const v = modePaiementLu(value);
  // Sans thème passé (écran Fournisseurs) : les variables de ses styles (`--fu-*`).
  const coul = C || { muted: 'var(--fu-gris)', text: 'var(--fu-encre)', border: 'var(--fu-filet)', card: 'var(--fu-carte)', bg: 'var(--fu-carte)' };
  return (
    <div role="group" aria-label={tr('achat.paiement.titre')} data-achat-paiement={v} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: coul.muted, fontWeight: 600 }}>{tr('achat.paiement.titre')}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MODES_PAIEMENT.map((m) => (
          <button key={m} type="button" data-achat-paiement-choix={m} aria-pressed={v === m} onClick={() => onChange(v === m ? '' : m)}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: `1px solid ${v === m ? (coul.text || 'currentColor') : (coul.border || '#ccc')}`,
              background: v === m ? (coul.text || '#111') : (coul.card || 'transparent'), color: v === m ? (coul.bg || '#fff') : (coul.text || 'inherit'),
              fontSize: 15, fontWeight: v === m ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>{tr('achat.paiement.' + m)}</button>
        ))}
      </div>
    </div>
  );
}
