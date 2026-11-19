// ════════════════════════════════════════════════════════════════════════════
//  « À RÉGLER · N » — le bloc discret en tête d'un onglet (19 nov., Julien : « ça doit être rangé dans les onglets
//  dédiés », puis « l'outil doit être pratique, pas chiant »).
//  · Une ligne repliée par défaut (« À régler · 4 ») : jamais une pile de reproches en tête d'écran. Elle s'ouvre
//    d'elle-même seulement si un groupe presse (ambre : une date limite LUE proche, un doublon…).
//  · Ouverte : 3 rangées, puis « Tout voir ». Une rangée = icône ou photo, le titre (avec son nombre), le détail, et
//    LE geste d'avant (le même que la carte de Ma journée) — la rangée entière se touche.
//  · Un groupe vide n'existe pas ; aucun groupe ⇒ rien n'est rendu (pas de carte vide).
//  AUCUNE règle : les groupes viennent de la publication d'Aujourd'hui (src/designV2/aRegler.js), ou de la prop
//  `groupes` (un écran qui a déjà sa liste). Composant autonome : `<ARegler onglet="ventes" Icon={Icon} Photo={Photo}/>`.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { RangeeTouchable } from './BoutonV2.jsx';
import { groupesDe, lireARegler, abonnerARegler, atelierCompleter } from './aRegler.js';
import './a-regler.css';

const VISIBLES = 3;

// La publication, relue quand elle change (un écran gardé qui revient la relit aussi).
export function useARegler() {
  return React.useSyncExternalStore(abonnerARegler, lireARegler, () => null);
}

export default function ARegler({ onglet, Icon, Photo = null, groupes = null, attrs = {} }) {
  const pub = useARegler();
  const source = groupes || (pub ? pub.groupes : null);
  const liste = React.useMemo(() => (source ? groupesDe(onglet, source, { completer: atelierCompleter(), titreCompleter: (n) => (n > 0 ? tr('v2.reg.completerN', { n }) : tr('v2.reg.completer')) }) : []), [source, onglet]);
  const presse = liste.some((g) => g.ambre);
  const [choix, setChoix] = React.useState(null);        // null = le défaut (ouvert seulement si ça presse)
  const [tout, setTout] = React.useState(false);
  const ouvert = choix == null ? presse : choix;
  if (!liste.length || onglet === 'messages') return null;
  const montres = tout ? liste : liste.slice(0, VISIBLES);
  const reste = liste.length - montres.length;
  const idCorps = 'v2-reg-' + onglet;
  return (
    <section className="v2-reg" data-v2-regler={onglet} data-v2-regler-n={String(liste.length)} data-v2-regler-ouvert={ouvert ? '1' : '0'} data-v2-regler-presse={presse ? '1' : '0'}
      data-v2-regler-frais={pub && pub.frais ? '1' : '0'} aria-label={tr('v2.reg.titre')} {...attrs}>
      <RangeeTouchable className="v2-reg-tete" onClick={() => setChoix(!ouvert)} label={tr('v2.reg.titreN', { n: liste.length })}
        attrs={{ 'data-v2-regler-bascule': '', 'aria-expanded': ouvert ? 'true' : 'false', 'aria-controls': idCorps }}>
        <span className="v2-reg-tete-txt">{presse ? <i className="v2-point" aria-hidden="true"/> : null}{tr('v2.reg.titre')}</span>
        <b className="v2-reg-tete-n" aria-hidden="true">{liste.length}</b>
        <span className="v2-reg-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
      </RangeeTouchable>
      <div id={idCorps} className="v2-reg-corps" hidden={!ouvert}>
        {ouvert ? montres.map((g) => {
          const faire = g.geste && typeof g.geste.faire === 'function' ? g.geste.faire : null;
          const dedans = (<>
            {g.photo && Photo
              ? <span className="v2-reg-photo" aria-hidden="true"><Photo src={g.photo} alt="" loading="lazy" decoding="async" width={40} height={40}/></span>
              : <span className="v2-reg-ic" aria-hidden="true"><Icon name={g.icone || 'check'} size={20}/></span>}
            <span className="v2-reg-txt">
              <span className="v2-reg-titre">{g.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{g.titre}</span>
              {g.detail ? <span className="v2-reg-detail">{g.detail}</span> : null}
            </span>
            {faire ? <span className="v2-reg-geste">{(g.geste && g.geste.txt) || tr('v2.reg.ouvrir')}<Icon name="chevron" size={14}/></span> : null}
          </>);
          return faire
            ? <RangeeTouchable key={g.id} className="v2-reg-ligne" onClick={faire} attrs={{ 'data-v2-regler-groupe': g.id, 'data-n': g.n == null ? '' : String(g.n), 'data-v2-regler-ambre': g.ambre ? '1' : undefined }}>{dedans}</RangeeTouchable>
            : <div key={g.id} className="v2-reg-ligne" data-v2-regler-groupe={g.id} data-n={g.n == null ? '' : String(g.n)}>{dedans}</div>;
        }) : null}
        {ouvert && (reste > 0 || tout) && liste.length > VISIBLES ? (
          <RangeeTouchable className="v2-reg-plus" onClick={() => setTout(!tout)} attrs={{ 'data-v2-regler-tout': tout ? '1' : '0' }}>
            <span>{tout ? tr('v2.reg.moins') : tr('v2.reg.toutVoir', { n: liste.length })}</span>
          </RangeeTouchable>
        ) : null}
      </div>
    </section>
  );
}
