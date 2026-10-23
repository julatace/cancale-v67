import React from 'react';
import {lireDiagnosticFavoris} from './diagnosticFavoris.js';

export default function DiagnosticFavoris({uid, owner, ownerActuel, base, headers}) {
  const [etat, setEtat] = React.useState({});
  const requete = React.useRef(0);
  React.useEffect(() => { requete.current++; setEtat({}); return () => { requete.current++; }; }, [uid, owner]);
  const verifier = async () => {
    const numero = ++requete.current;
    setEtat({occupe:true});
    try {
      const rapport = await lireDiagnosticFavoris({uid, owner, ownerActuel, base, headers:headers()});
      if (requete.current === numero && ownerActuel() === owner) setEtat({rapport});
    } catch (e) { if (requete.current === numero && ownerActuel() === owner) setEtat({erreur:e.message}); }
  };
  const copier = async () => {
    const numero = requete.current;
    if (ownerActuel() !== owner) return;
    try { await navigator.clipboard.writeText(JSON.stringify(etat.rapport,null,2)); if (requete.current === numero) setEtat(x=>({...x,retour:'Diagnostic copié.'})); }
    catch { if (requete.current === numero) setEtat(x=>({...x,retour:'Copie indisponible : sélectionne le texte ci-dessous.'})); }
  };
  return <details className="vrm-favoris-diagnostic"><summary>Préparer les messages aux favoris</summary>
    <p>Envois automatiques non activés. Cette vérification sert à relier les notifications aux bonnes conversations, sans envoyer de message.</p>
    <p>Sur Vinted, ouvre la cloche des notifications avec ce compte, puis reviens ici. Le diagnostic contient uniquement les noms et types des champs, sans pseudo, message, lien ou identifiant personnel.</p>
    {!uid&&<p>Choisis le compte Vinted à vérifier dans le sélecteur de compte.</p>}
    <button type="button" disabled={!uid||!owner||etat.occupe} onClick={verifier}>{etat.occupe?'Vérification…':'Vérifier la capture des notifications'}</button>
    {etat.erreur&&<p role="alert">{etat.erreur}</p>}
    {etat.rapport&&<>
      <p role="status">{etat.rapport.reception==='aucune_capture'?'Aucune capture reçue pour ce compte. Ouvre la cloche Vinted avec l’extension connectée, puis réessaie.':'Capture reçue. Tu peux partager ce diagnostic pour terminer le raccordement.'}</p>
      <button type="button" onClick={copier}>Copier le diagnostic</button>
      <pre tabIndex="0" aria-label="Diagnostic technique des favoris">{JSON.stringify(etat.rapport,null,2)}</pre>
    </>}
    {etat.retour&&<p role="status">{etat.retour}</p>}
  </details>;
}
