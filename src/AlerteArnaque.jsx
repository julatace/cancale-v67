// ── L'ALERTE ARNAQUE À L'ÉCRAN (11 nov., lot anti-arnaque ; 15 nov., lot securite-ventes) ────────
// La règle est dans `src/antiArnaque.js` (sans IA, seuls les messages PROUVÉS de
// l'autre personne, cinq langues). Ici, trois dessins et AUCUNE action : ni signalement,
// ni blocage, ni lecture, ni écriture — la bannière dit le risque ET le geste en UNE
// phrase, SON clic fait le reste sur la plateforme (`audit-anti-arnaque` B).
//   · <AlerteArnaque messages site lien?> : la bannière « Attention » en tête du fil ;
//   · <CompteurArnaque n>                 : « 2 conversations à surveiller » ;
//   · <PastilleArnaque motif>             : « Arnaque possible » sur la ligne.
// (15 nov.) Sobre : un fond ambre très léger, un triangle ambre, l'encre pour le texte —
// jamais de rouge (le rouge est réservé aux doublons de N°, §7). Les autres signes vus
// restent dans `data-arnaque-motifs` et le titre (survol), pas dans une seconde phrase.
import React from 'react';
import { tr } from './i18n/index.js';
import { alerteArnaque } from './antiArnaque.js';
import './design/arnaque.css';

const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const AMBRE = 'var(--sb-ambre-point, var(--vrm-warn, var(--n-ambre)))';   // un POINT, un trait (jamais un texte)
const AMBRE_TXT = 'var(--vrm-warn, var(--n-ambre))';   // un texte ambre (la pastille de la liste), comme avant

export function AlerteArnaque({ messages, site, lien = '', style }) {
  const a = React.useMemo(() => alerteArnaque(messages), [messages]);
  if (!a) return null;
  const nom = NOM_SITE[site] || '';
  const ou = nom || tr('antiArnaque.laPlateforme');
  const autres = a.motifs.length - 1;
  return (
    <div className="vrm-arnaque" role="note" data-arnaque={a.motif} data-arnaque-motifs={a.motifs.join(',')} data-arnaque-n={String(a.n)} data-arnaque-site={site || undefined}
      title={`${tr('antiArnaque.rienFait')}${autres > 0 ? ' ' + tr('antiArnaque.autres', { n: autres }) : ''}`} style={style}>
      <svg className="vrm-arnaque-icone" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
      <p className="vrm-arnaque-txt" data-arnaque-phrase="">
        <b>{tr('antiArnaque.attention')}</b> {tr(a.phrase, { site: ou })}
        {lien && nom ? <> <a className="vrm-arnaque-lien" href={lien} target="_blank" rel="noreferrer" data-arnaque-signaler={site}>{tr('antiArnaque.ouvrirSur', { site: nom })}</a></> : null}
      </p>
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
  return <span className="vrm-msg-etat" data-arnaque-ligne={motif} style={{ color: AMBRE_TXT, borderColor: AMBRE_TXT }}>{tr('antiArnaque.ligne')}</span>;
}
