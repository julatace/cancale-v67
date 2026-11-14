// ── CE QUE LA COQUE MONTE POUR LES LOTS 118, 119, 120, 127 (14 nov.) ────────────
// Un seul point de montage dans App.jsx (à côté de `VisionneusePdf`), une fois la
// session ouverte ET la double vérification passée :
//   · `VerrouCode`  (127) le code à 4 chiffres de CET appareil, s'il en a posé un ;
//   · `ApprouverQr` (119) quand l'appareil photo de l'iPhone a ouvert `?connexion-qr=…` ;
//   · `EcranAtelier`(118) sur « Écran d'atelier » (événement `vrm:atelier`) ou `?atelier` ;
//   · `useLienAideAJour` (120) renvoie la photo des colis tant qu'un lien d'aide est actif.
import React, { Suspense } from 'react';
import { VerrouCode } from './VerrouCode.jsx';
import { ApprouverQr } from './ConnexionQr.jsx';
import { useLienAideAJour } from './LienAide.jsx';

const EcranAtelier = React.lazy(() => import('./EcranAtelier.jsx'));
export const atelierDansLAdresse = () => { try { return new URL(window.location.href).searchParams.has('atelier'); } catch (_) { return false; } };

export default function ConfortCoque({ uid, entetes, onDeconnexion, ticketQr = '' }) {
  const [ticket, setTicket] = React.useState(ticketQr);
  const [atelier, setAtelier] = React.useState(atelierDansLAdresse);
  React.useEffect(() => {
    const f = () => setAtelier(true);
    window.addEventListener('vrm:atelier', f);
    return () => window.removeEventListener('vrm:atelier', f);
  }, []);
  useLienAideAJour(uid, entetes);
  return (
    <>
      {ticket ? <ApprouverQr ticket={ticket} entetes={entetes} onFin={() => setTicket('')}/> : null}
      {atelier ? <Suspense fallback={null}><EcranAtelier uid={uid} onFermer={() => setAtelier(false)}/></Suspense> : null}
      <VerrouCode onDeconnexion={onDeconnexion}/>
    </>
  );
}
