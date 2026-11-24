// ── « TA PREMIÈRE SEMAINE » — la carte d'Aujourd'hui (24 nov., lot debutant) ─────────────────────────────────
// La règle (étapes, preuves, qui la voit) : ./regle.js. Ici seulement le dessin, en composants natifs : un `Groupe`
// « Ta première semaine · 1 sur 3 » avec son « × », une `Progression`, une `Rangee` par étape (coche quand c'est FAIT
// et prouvé). L'étape courante, seule, porte sous elle : une phrase (≤ 8 mots), LE bouton plein (icône + verbe) et
// « Pourquoi ? » replié. Rien n'est coché par un toucher ; rien ne s'ouvre seul.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee, Progression, BoutonIcone, Glyphe, Actions, Pourquoi, Bouton } from '../natif/index.js';
import { nombreFaitesSemaine } from './regle.js';
import './premiere-semaine.css';

const ICONES = { compte: 'link', prix: 'euro', numero: 'tag' };
const GESTE_ICONE = { compte: 'play', prix: 'plus', numero: 'tag' };

export default function PremiereSemaine({ etapes, onGeste, onMasquer = null, onExemple = null, Icon = null, Mot = null }) {
  const n = nombreFaitesSemaine(etapes), total = etapes.length;
  const ic = (nom, t = 20) => (Icon ? <Icon name={nom} size={t}/> : null);
  return (
    <Groupe titre={tr('ps.titre') + ' · ' + tr('ps.rang', { n, total })}
      action={onMasquer ? <BoutonIcone libelle={tr('ps.masquer')} icone={<Glyphe nom="close" taille={16}/>} onClick={onMasquer} attrs={{ 'data-semaine-masquer': '' }}/> : null}
      attrs={{ 'data-premiere-semaine': `${n}/${total}` }}>
      <Progression pct={Math.round((n / Math.max(1, total)) * 100)} attrs={{ 'data-semaine-progression': String(n) }}/>
      {etapes.map((e, i) => {
        const fait = e.etat === 'fait';
        const titre = e.cle === 'numero' && Mot ? <>{tr('ps.numero.t1')} <Mot k="numero"/></> : tr(`ps.${e.cle}.t`);
        const pied = e.courante ? (
          <div className="vrm-ps-geste" data-semaine-geste={e.cle}>
            <p className="vrm-ps-phrase">{tr(`ps.${e.cle}.p`)}</p>
            <Actions elements={[{ cle: e.cle, plein: true, icone: ic(GESTE_ICONE[e.cle], 18), libelle: tr(`ps.${e.cle}.geste`), onClick: () => onGeste && onGeste(e.cle) }]}/>
            <Pourquoi attrs={{ 'data-semaine-pourquoi': e.cle }}>{tr(`ps.${e.cle}.pourquoi`)}</Pourquoi>
          </div>
        ) : null;
        return (
          <Rangee key={e.cle} icone={fait ? null : ic(ICONES[e.cle], 22)} titre={titre}
            sousTitre={fait ? tr('ps.fait') : e.courante ? '' : e.etat === 'passu' ? tr('ps.passu') : tr('ps.apres', { n: i })}
            fin={fait ? 'coche' : undefined} pied={pied}
            attrs={{ 'data-semaine-etape': e.cle, 'data-etat': e.etat, 'data-courante': e.courante ? '1' : '0' }}/>
        );
      })}
      {onExemple ? <div className="vrm-ps-exemple"><Bouton variante="texte" onClick={onExemple} attrs={{ 'data-semaine-exemple': '' }}>{tr('ps.exemple')}</Bouton></div> : null}
    </Groupe>
  );
}
