import React from 'react';
import {lireDiagnosticFavoris} from './diagnosticFavoris.js';
import {rapportAssistanceFavoris,bilanOuvertureFavori} from './favorisOuverture.js';

export default function DiagnosticFavoris({uid, owner, ownerActuel, base, headers, controle=null, controleEnvoi=null}) {
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
  const rapport=etat.rapport?rapportAssistanceFavoris(etat.rapport,controle,controleEnvoi):null;
  const bilan=bilanOuvertureFavori(controle);
  const copier = async () => {
    const numero = requete.current;
    if (ownerActuel() !== owner) return;
    try { await navigator.clipboard.writeText(JSON.stringify(rapport,null,2)); if (requete.current === numero) setEtat(x=>({...x,retour:'Diagnostic copié.'})); }
    catch { if (requete.current === numero) setEtat(x=>({...x,retour:'Copie indisponible : sélectionne le texte ci-dessous.'})); }
  };
  return <details className="vrm-favoris-diagnostic"><summary>Assistance technique · favoris</summary>
    <p role="status">{bilan}</p>
    <p>Le rapport ci-dessous réunit la dernière vérification sur Vinted et la structure des données captées. Après « Vérifier un favori », copie ce rapport pour transmettre aussi le résultat de l’ouverture.</p>
    <p>Ce contrôle technique ne déclenche aucune action sur Vinted. Il contient les noms et types des champs ainsi que des statuts techniques, sans pseudo, message, lien ou identifiant personnel.</p>
    {!uid&&<p>Choisis le compte Vinted à vérifier dans le sélecteur de compte.</p>}
    <button type="button" disabled={!uid||!owner||etat.occupe} onClick={verifier}>{etat.occupe?'Vérification…':'Vérifier la capture des notifications'}</button>
    {etat.erreur&&<p role="alert">{etat.erreur}</p>}
    {etat.rapport&&<>
      <p role="status">{etat.rapport.reception==='aucune_capture'?'Aucune capture reçue pour ce compte. Ouvre la cloche Vinted avec l’extension connectée, puis réessaie.':'Capture reçue. Sa structure est disponible ci-dessous pour l’assistance technique.'}</p>
      {etat.rapport.creation?.traces?.find(t=>t.api==='v2')?.rapprochement?.etat==='article_absent_de_la_capture'&&<p>La dernière conversation captée concerne un autre article que ceux de cette capture. Ce diagnostic ne confirme donc pas le destinataire des favoris sélectionnés.</p>}
      {etat.rapport.creation?.traces?.find(t=>t.api==='v2')?.rapprochement?.etat==='destinataire_non_confirme'&&<p>L’article correspond, mais le membre de la conversation ne correspond pas au champ utilisé par VRM. Copie le diagnostic ci-dessous pour corriger ce raccordement ; aucun message ne sera envoyé entre-temps.</p>}
      {etat.rapport.traces?.versionExtension&&<p>Version enregistrée dans les traces : {etat.rapport.traces.versionExtension}.</p>}
      {etat.rapport.traces?.observations?.some(x=>x.statut===401||x.statut===403)&&<p>Une lecture des notifications a été refusée par Vinted. Vérifie que le bon compte est accessible sur Vinted avant de réessayer.</p>}
      {etat.rapport.traces?.observations?.some(x=>x.statut===429)&&<p>Vinted demande de ralentir. Attends avant de relancer la lecture.</p>}
      <button type="button" onClick={copier}>Copier le diagnostic</button>
      <pre tabIndex="0" aria-label="Diagnostic technique des favoris">{JSON.stringify(rapport,null,2)}</pre>
    </>}
    {etat.retour&&<p role="status">{etat.retour}</p>}
  </details>;
}
