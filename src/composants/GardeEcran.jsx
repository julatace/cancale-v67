// ═══════════════════════════════════════════════════════════════════════════
// UN GARDE-FOU PAR ÉCRAN ET PAR FEUILLE (6 nov., filet 2 « l'app ne bug jamais »)
// ═══════════════════════════════════════════════════════════════════════════
// Il n'y avait qu'UN garde-fou (`EcranGardeFou`, App.jsx) autour de toute la
// zone des écrans : un écran qui tombait emportait avec lui les bandeaux de la
// coque, et une FEUILLE montée hors de cette zone (la fiche d'une paire, « Le
// prix partout », « Publier ailleurs », la présentation d'arrivée…) n'avait
// que le dernier filet de main.jsx : « L'application n'a pas pu démarrer »,
// barre de navigation comprise.
//
// Ici chaque écran et chaque feuille a le sien :
//   • quand rien ne plante, il rend ses enfants TELS QUELS (aucun élément du
//     DOM, aucun état lu, aucune lecture) — rien ne change au rendu ;
//   • quand son écran plante, il dit « Cet écran a un souci » à SA place, la
//     navigation (hors de lui) reste utilisable, « Réessayer » le remonte ;
//   • il note le plantage par le chemin existant (src/plantages.js), avec le
//     NOM de l'écran — c'est ce que lit la veille des plantages ;
//   • il se remet à zéro quand `resetKey` change (changer d'écran ou de section).
// Une feuille (`feuille`) dit la même chose dans une feuille qu'on FERME
// (`onFermer`), pour ne jamais laisser un voile sans sortie.
//
// ⚠️ Le texte garde « n'a pas pu s'afficher » (apostrophe droite) : une
// quarantaine de bancs reconnaissent un écran tombé à cette phrase.
//
// Le crochet de banc : `window.__VRM_BANC_PLANTE = '<nom>'` fait planter l'écran
// de ce nom — SEULEMENT servi depuis localhost ou 127.0.0.1 (jamais sur
// vrm.center) ; sert au banc `scripts/bancs/garde-ecrans.cjs`.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { noterPlantage } from '../plantages.js';

const versionBuild = () => (typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '');

export function plantageDeBancDemande(nom) {
  try {
    if (typeof window === 'undefined' || window.__VRM_BANC_PLANTE == null) return false;
    if (!/^(localhost|127\.0\.0\.1)$/.test(String(window.location.hostname || ''))) return false;
    return String(window.__VRM_BANC_PLANTE) === String(nom);
  } catch (_) { return false; }
}
function PlanteurDeBanc({ nom }) { throw new Error(`plantage de banc : ${nom}`); }

export class GardeEcran extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
    this.reessayer = () => this.setState({ err: null });
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    try { console.error('[VRM] écran en erreur', this.props.nom, err, info && info.componentStack); } catch (_) {}
    noterPlantage(err, { origine: this.props.feuille ? 'feuille' : 'ecran', ecran: String(this.props.nom || ''), version: versionBuild() });
  }
  componentDidUpdate(prev) {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null });
  }
  render() {
    const { nom, feuille, onFermer, children } = this.props;
    if (!this.state.err) return plantageDeBancDemande(nom) ? <PlanteurDeBanc nom={nom}/> : (children === undefined ? null : children);
    const msg = String((this.state.err && this.state.err.message) || this.state.err).slice(0, 400);
    const carte = (
      <div role="alert" className="vrm-etat-panne vrm-garde-ecran" data-garde-ecran={String(nom || '')}>
        <div className="vrm-etat-panne-texte">
          <p className="vrm-etat-panne-phrase">{feuille ? 'Cette fenêtre a un souci' : 'Cet écran a un souci'}</p>
          <p className="vrm-etat-panne-raison">
            {feuille ? "Elle n'a pas pu s'afficher. " : "Il n'a pas pu s'afficher. "}
            Le reste de l'application fonctionne{feuille ? '' : ' : change d’écran en bas'}, tes données ne sont pas touchées. Le souci est noté.
          </p>
          <p className="vrm-garde-ecran-erreur" data-garde-erreur="">{msg}</p>
        </div>
        <div className="vrm-garde-ecran-gestes">
          <button type="button" className="vrm-b vrm-b-secondaire" data-garde-reessayer="" onClick={this.reessayer}>Réessayer</button>
          {feuille && onFermer
            ? <button type="button" className="vrm-b vrm-b-discret" data-garde-fermer="" onClick={() => { this.setState({ err: null }); try { onFermer(); } catch (_) {} }}>Fermer</button>
            : <button type="button" className="vrm-b vrm-b-discret" data-garde-recharger="" onClick={() => { try { window.location.reload(); } catch (_) {} }}>Recharger l’app</button>}
          {/* (6 nov.) « Signaler un problème » en un bouton : l'écran tombé part avec.
              Posé par l'app (`GardeEcran.Signaler`), pour ne pas tirer ici la session. */}
          {GardeEcran.Signaler ? <GardeEcran.Signaler ecran={String(nom || '')} taille="petit"/> : null}
        </div>
      </div>
    );
    if (!feuille) return <div className="vrm-garde-ecran-hote">{carte}</div>;
    // Par un PORTAIL (§7) : un parent qui porte un `transform` ou un
    // `backdrop-filter` (la barre de recherche, l'île du haut) enfermerait sinon
    // le voile « plein écran » dans sa propre boîte.
    const voile = <div className="vrm-garde-feuille" data-garde-feuille={String(nom || '')}>{carte}</div>;
    // Dans la coque (`.vrm-app-shell`, qui porte les couleurs du thème), sinon sur <body>.
    try { if (typeof document !== 'undefined' && document.body) return createPortal(voile, document.querySelector('.vrm-app-shell') || document.body); } catch (_) {}
    return voile;
  }
}

GardeEcran.Signaler = null;

export default GardeEcran;

// Un rendu calculé DANS un enfant, pas dans le parent : une feuille dont le
// contenu se calcule dans la coque (`{x && (() => { … })()}`) plantait la coque
// elle-même, hors de portée de tout garde-fou. `<Differe rendre={() => …}/>`
// fait le même calcul, au même moment, mais sous le garde-fou qui l'entoure.
export function Differe({ rendre }) { const r = rendre(); return r === undefined ? null : r; }
