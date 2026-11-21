// ════════════════════════════════════════════════════════════════════════════
//  « À RÉGLER · N » — le groupe discret en tête d'un onglet (19 nov., Julien : « ça doit être rangé dans les onglets
//  dédiés », puis « l'outil doit être pratique, pas chiant »). « VRM natif » : un <Groupe> replié de <Rangee>.
//  · Replié par défaut (UNE ligne : « À régler · 4 ») : jamais une pile de reproches en tête d'écran. Il s'ouvre de
//    lui-même seulement si une rangée presse (ambre : une date limite LUE proche, un doublon…).
//  · Ouvert : 3 rangées, puis « Tout voir ». Une rangée = icône ou photo, le titre (avec son nombre), le détail ; la
//    rangée ENTIÈRE se touche et fait LE geste d'avant (celui de la carte de Ma journée).
//  · Aucun groupe ⇒ rien n'est rendu (pas de carte vide).
//  AUCUNE règle : les groupes viennent de la publication d'Aujourd'hui (src/designV2/aRegler.js), ou de la prop
//  `groupes` (un écran qui a déjà sa liste). Autonome : `<ARegler onglet="ventes" Icon={Icon} Photo={Photo}/>`.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee, Vignette, poserIcone, iconePosee } from '../natif/index.js';
import { groupesDe, atelierCompleter } from './aRegler.js';
import { useARegler } from './useARegler.js';
export { useARegler };

const VISIBLES = 3;

export default function ARegler({ onglet, Icon, Photo = null, groupes = null, ouvertDefaut = false }) {
  if (Icon && !iconePosee()) poserIcone(Icon);   // les glyphes natifs (chevron) = les tracés de l'app
  const pub = useARegler();
  const source = groupes || (pub ? pub.groupes : null);
  const liste = React.useMemo(() => (source ? groupesDe(onglet, source, { completer: atelierCompleter(), titreCompleter: (n) => (n > 0 ? tr('v2.reg.completerN', { n }) : tr('v2.reg.completer')) }) : []), [source, onglet]);
  const presse = liste.some((g) => g.ambre);
  const [choix, setChoix] = React.useState(null);        // null = le défaut (ouvert seulement si ça presse)
  const [tout, setTout] = React.useState(false);
  const ouvert = choix == null ? (presse || !!ouvertDefaut) : choix;   // (21 nov.) `ouvertDefaut` : dans la feuille d'accès de Ventes au téléphone
  if (!liste.length || onglet === 'messages') return null;
  const montres = tout ? liste : liste.slice(0, VISIBLES);
  return (
    <Groupe titre={tr('v2.reg.titre')} repli={{ ouvert, onBascule: () => setChoix(!ouvert), n: liste.length }}
      attrs={{ 'data-v2-regler': onglet, 'data-v2-regler-n': String(liste.length), 'data-v2-regler-ouvert': ouvert ? '1' : '0', 'data-v2-regler-presse': presse ? '1' : '0', 'data-v2-regler-frais': pub && pub.frais ? '1' : '0' }}>
      {montres.map((g) => { const photo = g.photo && Photo && onglet !== 'achats'; return (
        // (21 nov., capture iPhone de Julien : deux cases vides en tête d'Achats) Achats : une rangée de groupe (« Colis à vérifier »,
        // « 5 arrivés à ranger ») porte son ICÔNE, jamais la photo d'un seul de ses éléments (une photo Vinted expirée = une case vide).
        <Rangee key={g.id} titre={g.titre} sousTitre={g.detail || ''} ton={g.ambre ? 'ambre' : 'neutre'}
          vignette={photo ? <Photo className="n-vignette" data-n-taille={44} src={g.photo} alt="" width={44} height={44} loading="lazy" decoding="async"/> : null}
          icone={photo ? null : (Icon ? <Icon name={g.icone || 'check'} size={22}/> : <Vignette taille={44}/>)}
          fin={g.geste && typeof g.geste.faire === 'function' ? 'chevron' : null} onClick={g.geste && typeof g.geste.faire === 'function' ? g.geste.faire : null}
          attrs={{ 'data-v2-regler-groupe': g.id, 'data-n': g.n == null ? '' : String(g.n), 'data-v2-regler-ambre': g.ambre ? '1' : undefined, 'data-v2-regler-photo': photo ? '1' : '0' }}/>
      ); })}
      {liste.length > VISIBLES ? <Rangee titre={tout ? tr('v2.reg.moins') : tr('v2.reg.toutVoir', { n: liste.length })} onClick={() => setTout(!tout)} attrs={{ 'data-v2-regler-tout': tout ? '1' : '0' }}/> : null}
    </Groupe>
  );
}
