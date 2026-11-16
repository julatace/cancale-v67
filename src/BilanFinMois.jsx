// ════════════════════════════════════════════════════════════════════════════
//  LE BILAN DE FIN DE MOIS — SES EXPORTS (15 nov., lot argent-plus)
//  `ExportBilanMois` : le pied de la carte « Bilan du mois » — le PDF (déjà là),
//  le TABLEUR du même bilan (src/bilanFinMois.js `lignesTableurBilan`, les MÊMES
//  lignes que la carte et le PDF) et « Pour ton comptable » (le zip complet de
//  l'export comptable, ouvert sur CE mois — rien n'est lu avant son clic).
//  Composant séparé : l'écran Argent (refonte « verre ») le place où il veut.
//  Aucun import d'App.jsx : `Bouton`, `telecharger` et les actions arrivent en props.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { lignesTableurBilan, nomFichierTableurBilan } from './bilanFinMois.js';
import { csvDe } from './exportDonnees.js';
import './argent-plus-2.css';

export function ExportBilanMois({ D, ym, Bouton, telechargerPdf, telecharger, ouvrirComptable = null }) {
  const [enCours, setEnCours] = React.useState('');
  const tableur = () => {
    const L = lignesTableurBilan(D, tr);
    if (!L || enCours) return;
    setEnCours('csv');
    try { telecharger(new Blob([csvDe(L)], { type: 'text/csv;charset=utf-8' }), nomFichierTableurBilan(ym), 'text/csv;charset=utf-8'); } catch (_) { /* le navigateur a refusé : rien d'écrit */ }
    setEnCours('');
  };
  const pdf = async () => { if (enCours) return; setEnCours('pdf'); try { await telechargerPdf(); } finally { setEnCours(''); } };
  return (
    <div className="vrm-bilan-pied" data-bilan-exports="">
      <Bouton variante="secondaire" icone="save" occupe={enCours === 'pdf'} data-bilan-pdf="" onClick={pdf}>{tr('compta.telechargerPdf2')}</Bouton>
      <Bouton variante="secondaire" icone="doc" occupe={enCours === 'csv'} data-bilan-csv="" onClick={tableur}>{tr('argentPlus.bilan.tableur')}</Bouton>
      {ouvrirComptable ? <Bouton variante="discret" className="sb-lien" data-bilan-comptable={ym} onClick={() => ouvrirComptable(ym)}>{tr('argentPlus.bilan.comptable')}</Bouton> : null}
    </div>
  );
}
export default ExportBilanMois;
