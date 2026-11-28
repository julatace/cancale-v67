// La puce « Proposer » (IA de ton navigateur) à côté de SES réponses rapides — src/reponseNavigateur.js (28 nov., ia-sans-cle).
// Visible seulement quand le modèle intégré au navigateur est PRÊT sur l'appareil et que le dernier message est de
// l'acheteur ; le texte validé REMPLIT le champ (rien ne part). Aucune clé, aucun réseau.
import React from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { etatModele, ouvrirSession, demanderJSON, fermerSession } from './iaNavigateur.js';
import { consigneReponse, SCHEMA_REPONSE_MESSAGE, messageReponse, aRepondre, lireReponse } from './reponseNavigateur.js';

export default function ReponseNavigateur({ messages = [], vars = {}, sur, onChoisir }) {
  const [modele, setModele] = React.useState(undefined);
  const [etat, setEtat] = React.useState('idle');   // idle | charge | ko
  React.useEffect(() => { let vivant = true; etatModele({ langue: langueCourante() }).then((e) => { if (vivant) setModele(e); }); return () => { vivant = false; }; }, []);
  if (modele !== 'disponible' || !onChoisir || !aRepondre(messages)) return null;
  const proposer = async () => {
    if (etat === 'charge') return;
    setEtat('charge');
    const s = await ouvrirSession({ systeme: consigneReponse(langueCourante()), langue: langueCourante() });
    const j = s ? await demanderJSON(s, messageReponse({ messages, vars }), SCHEMA_REPONSE_MESSAGE) : { ok: false };
    fermerSession(s);
    const t = j.ok ? lireReponse(j.objet, { sur }) : null;
    if (t) { setEtat('idle'); onChoisir(t); } else setEtat('ko');
  };
  return (
    <button type="button" className="vrm-mp-rr" data-rr-ia-navigateur={etat} data-n-famille="second" onClick={proposer} disabled={etat === 'charge'}
      title={etat === 'ko' ? tr('iaNav.rep.ko') : tr('iaNav.rep.titre')}>
      {etat === 'charge' ? tr('iaNav.rep.charge') : etat === 'ko' ? tr('iaNav.rep.koCourt') : tr('iaNav.rep.b')}
    </button>
  );
}
