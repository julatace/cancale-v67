// ── « BIEN DÉMARRER 3/5 » : la carte d'Aujourd'hui (21 nov., ux-reglages) ─────────────────────────────────────────
// La règle (étapes, preuves, qui la voit) : ./regle.js. Ici seulement ce qui se dessine, en composants natifs :
// un `Groupe` « Bien démarrer · 3/5 » avec son « × », une `Progression`, une `Rangee` par étape (coche quand c'est
// FAIT et prouvé ; sinon la rangée mène au geste). Rien n'est coché par un toucher : la rangée OUVRE l'écran du geste.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee, Progression, BoutonIcone, Glyphe } from '../natif/index.js';
import { nombreFaites } from './regle.js';

export default function BienDemarrer({ etapes, onEtape, onMasquer, Icon = null }) {
  const n = nombreFaites(etapes), total = etapes.length;
  const ICONES = { extension: 'device', compte: 'link', lecture: 'sync', numeros: 'tag', fiscal: 'receipt' };
  return (
    <Groupe titre={tr('uxr.bd.titre') + ' · ' + tr('uxr.bd.rang', { n, total })}
      action={onMasquer ? <BoutonIcone libelle={tr('uxr.bd.masquer')} icone={<Glyphe nom="close" taille={16}/>} onClick={onMasquer} attrs={{ 'data-ux-bd-masquer': '' }}/> : null}
      attrs={{ 'data-ux-bien-demarrer': `${n}/${total}` }}>
      <Progression pct={Math.round((n / Math.max(1, total)) * 100)} attrs={{ 'data-ux-bd-progression': String(n) }}/>
      {etapes.map((e) => {
        const fait = e.etat === 'fait';
        const sous = fait ? tr('uxr.bd.fait') : e.etat === 'passu' ? tr('uxr.bd.extensionPasSu') : e.attente ? tr(e.attente) : '';
        return (
          <Rangee key={e.cle} icone={Icon ? <Icon name={ICONES[e.cle] || 'check'} size={22}/> : null} titre={tr('uxr.bd.' + e.cle)} sousTitre={sous}
            fin={fait ? 'coche' : (onEtape ? 'chevron' : undefined)} onClick={!fait && onEtape ? () => onEtape(e.cle) : undefined}
            attrs={{ 'data-ux-bd-etape': e.cle, 'data-ux-bd-etat': e.etat }}/>
        );
      })}
    </Groupe>
  );
}
