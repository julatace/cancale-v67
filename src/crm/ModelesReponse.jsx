// ── src/crm/ModelesReponse.jsx — les modèles de réponse d'une conversation eBay (28 nov., lot ebay-crm, C2) ──
import React from 'react';
import { tr } from '../i18n/index.js';
import { remplir, lireModeles } from './api.js';
import './crm.css';

// Les modèles d'une conversation : un toucher remplit le message. Un modèle dont une variable n'est pas
// sue (le suivi, dans une conversation) est grisé et dit ce qui manque — jamais un « {suivi} » envoyé.
export default function ModelesReponse({ headers, compte, vars, onChoisir }) {
  const [modeles, setModeles] = React.useState(undefined);
  React.useEffect(() => { let vivant = true; lireModeles(headers, compte).then((m) => { if (vivant) setModeles(m); }); return () => { vivant = false; }; }, [compte]);
  if (!Array.isArray(modeles) || !modeles.length) return null;
  return <div className="crm-modeles" role="group" aria-label={tr('crm.reponses.choisir')} data-crm-modeles={modeles.length}>
    {modeles.map((m) => { const t = remplir(m.texte, vars); const manque = t ? '' : (m.texte.match(/\{([a-zA-Z]+)\}/g) || []).find((v) => !vars[v.slice(1, -1)]) || '';
      return <button key={m.id} type="button" className="crm-modele" disabled={!t} title={manque ? tr('crm.reponses.manque', { variable: manque }) : undefined} data-crm-modele={m.id} onClick={() => t && onChoisir(t)}>{m.nom}</button>; })}
  </div>;
}

