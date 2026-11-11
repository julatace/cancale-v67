// ── L'ALERTE ARNAQUE À L'ÉCRAN (11 nov., lot anti-arnaque) ────────────────
// La règle est dans `src/antiArnaque.js` (sans IA, seuls les messages PROUVÉS de
// l'autre personne). Ici, trois dessins et AUCUNE action : ni signalement, ni
// blocage, ni lecture, ni écriture — la bannière dit la raison et le geste,
// SON clic fait le reste sur la plateforme (`audit-anti-arnaque` B).
//   · <AlerteArnaque messages site lien?> : la bannière ambre en tête du fil ;
//   · <CompteurArnaque n>                 : « 2 conversations à surveiller » ;
//   · <PastilleArnaque motif>             : « Arnaque possible » sur la ligne.
// Couleurs par les variables du thème (ambre = un geste à faire, §7).
import React from 'react';
import { tr } from './i18n/index.js';
import { alerteArnaque } from './antiArnaque.js';

const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const AMBRE = 'var(--vrm-warn, #B25000)';

export function AlerteArnaque({ messages, site, lien = '', style }) {
  const a = React.useMemo(() => alerteArnaque(messages), [messages]);
  if (!a) return null;
  const nom = NOM_SITE[site] || '';
  const autres = a.motifs.length - 1;
  return (
    <div className="vrm-arnaque" role="note" data-arnaque={a.motif} data-arnaque-motifs={a.motifs.join(',')} data-arnaque-n={String(a.n)} data-arnaque-site={site || undefined}
      title={tr('antiArnaque.rienFait')}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '0 0 6px', padding: '10px 12px', borderRadius: 12,
        border: `1px solid ${AMBRE}`, background: 'var(--vrm-warn-soft, #FFF4E5)', color: 'var(--vrm-ink, #1D1D1F)', fontSize: 13, lineHeight: 1.45, flexShrink: 0, ...(style || {}) }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div data-arnaque-raison=""><b>{tr('antiArnaque.titre')}</b>{tr('antiArnaque.separateur')}{tr(a.raison)}</div>
        <div data-arnaque-geste="" style={{ marginTop: 2 }}>
          {tr(a.geste)}{nom ? <> {lien
            ? <a href={lien} target="_blank" rel="noreferrer" data-arnaque-signaler={site} style={{ color: 'inherit', fontWeight: 600 }}>{tr('antiArnaque.signaler', { site: nom })}</a>
            : <span data-arnaque-signaler={site}>{tr('antiArnaque.signaler', { site: nom })}</span>}</> : null}
          {autres > 0 ? <span style={{ color: 'var(--vrm-muted, #6E6E73)' }}> {tr('antiArnaque.autres', { n: autres })}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function CompteurArnaque({ n, style }) {
  if (!(n > 0)) return null;
  return (
    <p data-arnaque-compteur={String(n)} title={tr('antiArnaque.rienFait')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--vrm-ink, #1D1D1F)', lineHeight: 1.4, margin: '0 0 8px', ...(style || {}) }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: AMBRE, flexShrink: 0 }}/>
      {tr('antiArnaque.compteur', { n })}
    </p>
  );
}

export function PastilleArnaque({ motif }) {
  if (!motif) return null;
  return <span className="vrm-msg-etat" data-arnaque-ligne={motif} style={{ color: AMBRE, borderColor: AMBRE }}>{tr('antiArnaque.ligne')}</span>;
}
