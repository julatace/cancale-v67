// ── src/aujourdhui/TeteDroite.jsx — la droite de l'en-tête d'Aujourd'hui à l'ordinateur (22 nov. soir, maquettes de Julien) ──
// « ● Mis à jour il y a 1 min » · relire · chercher · la cloche (avec son nombre). Rien de neuf n'est calculé :
//   · l'heure = la dernière lecture RÉUSSIE de la veille (src/tempsReel.js `ecouterLue`) ; pas encore de réponse ⇒ rien d'écrit ;
//   · relire = la même relecture que « Rafraîchir » des tableaux (`vrm:relire-coque`) + un sondage de la veille ;
//   · chercher = LA recherche de la coque (`vrm:recherche-ouvrir`, ⌘K et « / » marchent toujours) ;
//   · la cloche = le centre de notifications (`vrm:centre-notifs`), son nombre publié par la cloche de la coque (src/notifsCompte.js).
import React from 'react';
import { tr, nombre } from '../i18n/index.js';
import { BoutonIcone } from '../natif/index.js';
import { ecouterLue, derniereLue } from '../tempsReel.js';
import { suivreNotifsNonLues, notifsNonLues } from '../notifsCompte.js';

const envoyer = (nom) => { try { window.dispatchEvent(new Event(nom)); } catch (_) { /* rien */ } };

export function ilYaLu(at, maintenant = Date.now()) {
  if (!Number.isFinite(at)) return '';
  const s = Math.max(0, Math.round((maintenant - at) / 1000));
  if (s < 45) return tr('tete.lu.instant');
  const m = Math.round(s / 60);
  if (m < 60) return tr('tete.lu.min', { n: m });
  return tr('tete.lu.h', { n: Math.round(m / 60) });
}

export default function TeteDroite({ Icon }) {
  const [lue, setLue] = React.useState(() => derniereLue());
  const [n, setN] = React.useState(() => notifsNonLues());
  const [, tic] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const offL = ecouterLue((at) => setLue(at));
    const offN = suivreNotifsNonLues((v) => setN(v));
    const t = setInterval(tic, 30000);   // « il y a N min » avance sans relire
    return () => { offL(); offN(); clearInterval(t); try { document.documentElement.removeAttribute('data-tete-lu'); } catch (_) { /* rien */ } };
  }, []);
  const [relit, setRelit] = React.useState(false);
  const relire = () => {
    setRelit(true); setTimeout(() => setRelit(false), 1200);
    envoyer('vrm:relire-coque');
    try { if (window.__vrmVeille) window.__vrmVeille.sonder(); } catch (_) { /* rien */ }
  };
  // L'en-tête dit l'heure : la pastille flottante « Mis à jour à » se tait sur cet écran (styles-temps-reel.css).
  React.useEffect(() => { try { if (lue) document.documentElement.setAttribute('data-tete-lu', '1'); } catch (_) { /* rien */ } }, [lue]);
  const nb = Number.isFinite(n) && n > 0 ? n : 0;
  return (
    <div className="n-tb-droite" data-tete-droite="">
      {lue ? <span className="n-tb-lu" data-copie-vide="" data-tete-lu={String(lue)}><span className="n-tb-lu-point" aria-hidden="true"/>{tr('tete.lu', { quand: ilYaLu(lue) })}</span> : null}
      <BoutonIcone libelle={tr('tete.relire')} icone={<Icon name="sync" size={18}/>} onClick={relire} className="n-tb-rond" attrs={{ 'data-tete-relire': relit ? '1' : '0' }}/>
      <BoutonIcone libelle={tr('tete.chercher')} icone={<Icon name="search" size={18}/>} onClick={() => envoyer('vrm:recherche-ouvrir')} className="n-tb-rond" attrs={{ 'data-tete-chercher': '' }}/>
      <BoutonIcone libelle={nb ? tr('tete.notifsN', { n: nb }) : tr('tete.notifs')} icone={<Icon name="bell2" size={18}/>} onClick={() => envoyer('vrm:centre-notifs')} className="n-tb-rond"
        pastille={nb ? <span className="n-tb-rond-n" aria-hidden="true">{nb > 9 ? '9+' : nombre(nb)}</span> : null} attrs={{ 'data-tete-cloche': String(nb) }}/>
    </div>
  );
}

