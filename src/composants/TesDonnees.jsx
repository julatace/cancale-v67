// ═══════════════════════════════════════════════════════════════════════════
// « TES DONNÉES » — Paramètres → Mon compte (8 nov., confiance)
// ═══════════════════════════════════════════════════════════════════════════
// Une page à lire, calme : ce que VRM lit (par site), ce que l'extension fait
// et quand, où c'est rangé, qui y a accès — puis les gestes (voir ce que
// l'extension a fait, exporter, fermer le compte, l'état de VRM). Les phrases
// viennent de `src/tesDonnees.js`, chacune tenue par une preuve dans le code
// (`scripts/audit-confiance.cjs`). Aucune lecture ici : rien ne peut « ne pas
// charger » — les gestes sont ceux des Paramètres (mêmes fonctions).
import React from 'react';
import { GroupeIos, RangeeIos } from './Ios.jsx';
import { CE_QUE_VRM_LIT, CE_QUE_VRM_NE_LIT_PAS, GESTES, STOCKAGE, ACCES } from '../tesDonnees.js';
import '../tes-donnees.css';

export default function TesDonnees({ onJournal, onExporter, onFermer, cloisonne = true }) {
  return (
    <div className="vrm-tes-donnees" data-tes-donnees="">
      <p className="vrm-td-intro">Ce que VRM lit, où il le range, et ce que l’extension fait en ton nom. Rien d’autre.</p>

      <GroupeIos titre="Ce que VRM lit" pied={CE_QUE_VRM_NE_LIT_PAS} data-td-groupe="lit">
        {CE_QUE_VRM_LIT.map((x) => <RangeeIos key={x.id} titre={x.titre} detail={x.detail} data-td-lit={x.id}/>)}
      </GroupeIos>

      {GESTES.map((g) => (
        <GroupeIos key={g.id} titre={'L’extension · ' + g.titre.charAt(0).toLowerCase() + g.titre.slice(1)} pied={g.pied} data-td-groupe={g.id}>
          {g.lignes.map((l) => <RangeeIos key={l.id} titre={l.texte} data-td-geste={g.id + ':' + l.id}/>)}
        </GroupeIos>
      ))}

      <GroupeIos titre="Où c’est rangé" data-td-groupe="stockage">
        {STOCKAGE.map((x) => <RangeeIos key={x.id} titre={x.titre} detail={x.detail} data-td-stockage={x.id}/>)}
      </GroupeIos>

      <GroupeIos titre="Qui y a accès" data-td-groupe="acces">
        {ACCES.map((x) => <RangeeIos key={x.id} titre={x.titre}
          detail={x.id === 'toi' && !cloisonne ? 'La séparation des comptes n’est pas encore activée sur cette installation.' : x.detail}
          data-td-acces={x.id} {...(x.id === 'toi' ? { 'data-td-cloisonne': cloisonne ? 'oui' : 'non' } : {})}/>)}
      </GroupeIos>

      <GroupeIos titre="Tes gestes" data-td-groupe="gestes">
        {onJournal && <RangeeIos titre="Ce que l’extension a fait" detail="Chaque geste fait en ton nom, daté, avec sa preuve." onClick={onJournal} data-td-journal=""/>}
        {onExporter && <RangeeIos titre="Exporter mes données" detail="Un fichier sur ton appareil : ventes, achats, stock, compta." onClick={onExporter} data-td-exporter=""/>}
        {onFermer && <RangeeIos titre="Fermer mon compte" detail="Tout effacer, définitivement, après confirmation." onClick={onFermer} data-td-fermer=""/>}
        <a className="vrm-td-lien" href="/statut" target="_blank" rel="noopener" data-td-statut="">
          <RangeeIos titre="État de VRM" detail="La base, les e-mails, les notifications, en direct." chevron/>
        </a>
        <a className="vrm-td-lien" href="/legal/confidentialite.html" target="_blank" rel="noopener" data-td-politique="">
          <RangeeIos titre="Politique de confidentialité" detail="Tes droits, les prestataires, les durées." chevron/>
        </a>
      </GroupeIos>
    </div>
  );
}
