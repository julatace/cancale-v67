// ════════════════════════════════════════════════════════════════════════════
//  « TÉLÉCHARGER TOUTES MES DONNÉES » (15 nov., lot argent-plus)
//  Paramètres → Sécurité des données : un ZIP fabriqué dans CE navigateur depuis SES
//  lignes (src/sauvegardeDonnees.js : JSON par catégorie, tableaux ventes / achats /
//  annonces, PDF de bordereaux encore présents), téléchargé sur l'appareil — rien
//  envoyé ailleurs. Rien n'est lu avant SON clic. Une lecture ratée est DITE
//  (« incomplet : … ») et le zip le dit aussi (LISEZMOI.txt), jamais présenté complet.
//  Aucun import d'App.jsx : les lecteurs, `Bouton` et `telecharger` arrivent en props.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { lireSauvegarde, zipSauvegarde } from './sauvegardeDonnees.js';
import './argent-plus-2.css';

export function SauvegardeDonnees({ Bouton, lireTout, lirePdf, owner, sources, telecharger, nomCompte }) {
  const [e, setE] = React.useState({ etat: 'repos' });
  const lancer = async () => {
    if (e.etat === 'encours') return;
    setE({ etat: 'encours', etape: 'liste', n: 0, total: 0 });
    try {
      const [lu, src] = await Promise.all([
        lireSauvegarde({ lireTout, lirePdf, owner, surEtape: (etape, n, total) => setE({ etat: 'encours', etape, n, total }) }),
        sources ? sources().catch(() => null) : Promise.resolve(null),
      ]);
      const z = zipSauvegarde({ lu, sources: src, quand: new Date(), nomCompte });
      telecharger(new Blob([z.octets], { type: 'application/zip' }), z.nom, 'application/zip');
      setE({ etat: z.etat.complet ? 'fini' : 'incomplet', nom: z.nom, n: z.n, nPdf: z.nPdf, manques: z.etat.manques });
    } catch (err) { setE({ etat: 'echec', raison: (err && err.message) || String(err) }); }
  };
  const ETAPES = { liste: tr('argentPlus.svg.etape.liste'), lignes: tr('argentPlus.svg.etape.lignes'), resumes: tr('argentPlus.svg.etape.resumes'), bordereaux: tr('argentPlus.svg.etape.bordereaux') };
  return (
    <div className="vrm-svg-bloc" data-sauvegarde-toutes={e.etat}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{tr('argentPlus.svg.titre')}</div>
      <p>{tr('argentPlus.svg.court')}</p>
      <details className="vrm-repli" data-sauvegarde-pourquoi=""><summary>{tr('argentPlus.svg.pourquoi')}</summary><p>{tr('argentPlus.svg.desc')}</p></details>
      <Bouton variante="secondaire" icone="archive" occupe={e.etat === 'encours'} data-sauvegarde-lancer="" onClick={lancer} style={{ alignSelf: 'flex-start' }}>
        {e.etat === 'encours' ? tr('argentPlus.svg.encours') : tr('argentPlus.svg.bouton')}
      </Bouton>
      {e.etat === 'encours' ? <p role="status" data-sauvegarde-etape={e.etape}>{ETAPES[e.etape] || ''}{e.total ? ` · ${e.n}/${e.total}` : ''}</p> : null}
      {e.etat === 'fini' ? <p role="status" className="vrm-svg-fin" data-sauvegarde-fin="complet" data-sauvegarde-n={e.n} data-sauvegarde-pdf={e.nPdf}>{tr('argentPlus.svg.fini', { nom: e.nom, n: e.n, p: e.nPdf })}</p> : null}
      {e.etat === 'incomplet' ? <p role="status" className="vrm-svg-fin" data-sauvegarde-fin="incomplet" data-sauvegarde-manques={e.manques.length}>{tr('argentPlus.svg.incomplet', { manques: e.manques.join(' · ') })}</p> : null}
      {e.etat === 'echec' ? <p role="alert" data-sauvegarde-fin="echec">{tr('argentPlus.svg.echec')}</p> : null}
    </div>
  );
}
export default SauvegardeDonnees;
