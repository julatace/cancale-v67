// ══════════════════════════════════════════════════════════════════════════════
//  RÉPONSES RAPIDES DANS L'ÉCRAN MESSAGES DE L'APP (21 nov. 2026, ext. 5.421, `reponsesrapides`)
// ══════════════════════════════════════════════════════════════════════════════
// La MÊME règle que le panneau (src/reponsesRapides.js : mots-clés, sans IA, SES modèles `vrm_reponses_rapides`
// recopiés dans le navigateur par la ligne `vrm_reglages_auto`), remplie avec les infos de CETTE paire (par identité :
// l'annonce de la conversation). L'app n'envoie rien (décision du 20 nov. : tout geste de plateforme se fait dans le
// panneau) : elle MONTRE la réponse ; « Envoyer depuis le panneau » ouvre la conversation dans le panneau, où la même
// réponse attend son toucher « Envoyer ».
import React, { useMemo } from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { rrPropositions } from './reponsesRapides.js';
import { risquesMessage } from './messageSur.js';

export default function ReponsesRapidesApp({ messages = [], vars = {}, partie = false, reglage = null, site = 'vinted', bouton = null }) {
  const r = useMemo(() => rrPropositions({ messages, reglage, vars, partie, langueUi: langueCourante(), sur: (t) => !risquesMessage(String(t || ''), site).length, hasard: () => 0 }),
    [messages, reglage, vars, partie, site]);
  const l = r.propositions || [];
  if (!l.length) return null;
  return (
    <div className="vrm-aide-rep" data-rr-app={l.length} role="group" aria-label={tr('rr.app.titre')}>
      <p className="vrm-aide-rep-q">{tr('rr.app.titre')}</p>
      {l.map((p) => p.texte
        ? <p key={p.cat} data-rr-app-cat={p.cat} style={{ margin: '4px 0', fontSize: 14, lineHeight: '19px' }}><small style={{ display: 'block', opacity: 0.7 }}>{tr('rr.app.cat.' + p.cat)}</small>{p.texte}</p>
        : <p key={p.cat} data-rr-app-manque={p.manque || ''} style={{ margin: '4px 0', fontSize: 13, opacity: 0.75 }}>{tr('rr.app.manque', { cat: tr('rr.app.cat.' + p.cat) })}</p>)}
      {l.some((p) => p.texte) ? <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }} data-rr-app-note="">{tr('rr.app.note')}</p> : null}
      {bouton}
    </div>
  );
}
