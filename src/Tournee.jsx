// ════════════════════════════════════════════════════════════════════════════
//  LA TOURNÉE — la carte en tête de Ma journée et son mode plein écran (1er nov.)
//  Les étapes et les arrêts viennent de `src/tournee.js` (règle pure) ; cet
//  écran n'en recalcule aucun. Chaque étape ouvre l'écran qui fait le geste
//  (`onEtape`) : impression des prêts, Colis, la colonne « À retirer ».
//  La carte du mode plein écran est `CarteRelaisColis` (celle de Colis), avec les
//  seuls points relais : un point de DÉPÔT n'est relié à un colis par aucune
//  identité, il n'a donc pas d'épingle (jamais devinée).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import CarteRelaisColis from './CarteRelais.jsx';
import { texteJours } from './tournee.js';
import './styles-tournee.css';

const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

function texteEtape(e) {
  if (e.id === 'imprimer') {
    if (e.etat === 'passu') return { t: 'Imprimer les bordereaux', s: e.auMoins ? 'Ouvre Colis : il lit les bordereaux que l’extension a récupérés' : 'Je lis encore tes bordereaux…' };
    if (e.etat === 'rien') return { t: 'Imprimer', s: 'Aucun bordereau prêt à imprimer' };
    const qui = (e.parTransporteur || []).map((x) => `${x.nom} ×${x.n}`).join(' · ');
    if (e.etat === 'fait') return { t: e.n ? `Imprimer ${plur(e.n, 'bordereau', 'bordereaux')}` : 'Imprimer les bordereaux', s: e.n ? `Tous imprimés${qui ? ' · ' + qui : ''}` : "Imprimés aujourd'hui" };
    const deja = e.n - e.reste;
    return { t: `Imprimer ${e.auMoins ? 'au moins ' : ''}${plur(e.n, 'bordereau', 'bordereaux')}`, s: [deja > 0 ? `${deja} déjà imprimé${deja > 1 ? 's' : ''}` : '', qui, e.auMoins ? 'Colis dira s’il y en a d’autres' : ''].filter(Boolean).join(' · ') || 'Prêts à imprimer' };
  }
  if (e.id === 'emballer') {
    if (e.etat === 'passu') return { t: 'Emballer', s: 'Je lis encore tes ventes…' };
    if (e.etat === 'rien') return { t: 'Emballer', s: 'Aucun colis à emballer' };
    if (e.etat === 'fait') return { t: 'Emballer', s: "Tout est parti aujourd'hui" };
    // Le total n'est pas réécrit : c'est le nombre de la case « À envoyer » (§7).
    return { t: 'Emballer', s: e.numeros.length ? [e.numeros.map((n) => `N°${n}`).join(' · '), e.sansNumero ? `${e.sansNumero} sans N°` : ''].filter(Boolean).join(' · ') : 'Aucune de ces paires n’a encore de N°' };
  }
  if (e.id === 'deposer') {
    if (e.etat === 'passu') return { t: 'Déposer', s: 'Je lis encore tes ventes…' };
    if (e.etat === 'rien') return { t: 'Déposer', s: 'Aucun colis à déposer' };
    if (e.etat === 'fait') return { t: 'Déposer', s: "Déposés aujourd'hui" };
    const d = e.depots || [];
    const seul = d.length === 1 ? d[0] : null;
    const presse = d.filter((x) => x.jours != null).sort((a, b) => a.jours - b.jours)[0];
    const quand = presse ? texteJours(presse.jours, 'depot') : '';
    if (seul) return { t: `Déposer${seul.nom ? ` · ${seul.nom}` : ''}`, s: [seul.nom ? '' : 'transporteur pas encore connu', quand].filter(Boolean).join(' · ') };
    return { t: 'Déposer', s: [d.map((x) => `${x.nom || 'transporteur pas encore connu'} ${x.n}`).join(' · '), quand ? `le plus pressé : ${quand}` : ''].filter(Boolean).join(' · ') };
  }
  // retirer
  if (e.etat === 'passu') return { t: 'Retirer', s: 'Je lis encore tes colis à retirer…' };
  if (e.etat === 'rien') return { t: 'Retirer', s: 'Aucun colis à retirer' };
  if (e.etat === 'fait') return { t: 'Retirer', s: "Retirés aujourd'hui" };
  const pts = e.points || [];
  const seul = pts.length === 1 ? pts[0] : null;
  const presse = pts.filter((x) => x.jours != null).sort((a, b) => a.jours - b.jours)[0];
  if (seul) return { t: `Retirer${seul.nom ? ` · ${seul.nom}` : ''}`, s: [seul.nom ? '' : 'point pas encore connu', seul.jours != null ? texteJours(seul.jours, 'retrait') : ''].filter(Boolean).join(' · ') || 'Le code est dans Colis' };
  return { t: 'Retirer', s: [pts.map((x) => `${x.nom || 'point pas encore connu'} ${x.n}`).join(' · '), presse ? `le plus pressé : ${presse.nom || 'point pas encore connu'}, ${texteJours(presse.jours, 'retrait')}` : ''].filter(Boolean).join(' · ') };
}

function Pastille({ e, i }) {
  if (e.etat === 'fait') return <span className="vrm-tr-pastille is-fait" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
  return <span className={'vrm-tr-pastille' + (e.courante ? ' is-courante' : '')} aria-hidden="true">{i + 1}</span>;
}

export function CarteTournee({ tournee, nArrets = 0, onEtape, onOuvrirTournee }) {
  if (!tournee || !tournee.utile) return null;
  const { etapes } = tournee;
  return (
    <section className="vrm-tr" data-tournee="" data-tournee-faites={tournee.faites} aria-label="Ta tournée du jour">
      <header className="vrm-tr-tete">
        <h2 className="vrm-tr-titre">Ta tournée</h2>
        <span className="vrm-tr-compte">{tournee.faites} sur {etapes.length} faite{tournee.faites === 1 ? '' : 's'}</span>
      </header>
      <ol className="vrm-tr-etapes">
        {etapes.map((e, i) => {
          const tx = texteEtape(e);
          return (
            <li key={e.id} className={'vrm-tr-etape is-' + e.etat} data-tournee-etape={e.id} data-etat={e.etat} data-n={e.n == null ? '' : String(e.n)} data-courante={e.courante ? '1' : undefined}>
              <button type="button" className="vrm-tr-bouton" title={`${tx.t} — ${tx.s}${e.id === 'emballer' && e.numeros.length ? ' : N°' + e.numeros.join(', N°') : ''}`} onClick={() => onEtape && onEtape(e.id)}
                aria-label={`Étape ${i + 1}, ${tx.t}${e.etat === 'fait' ? ', faite' : ''} — ${tx.s}`}>
                <Pastille e={e} i={i}/>
                <span className="vrm-tr-texte">
                  <span className="vrm-tr-t">{e.etat === 'passu' ? <>{tx.t} <span className="vrm-tr-passu">—</span></> : tx.t}</span>
                  <span className="vrm-tr-s">{tx.s}</span>
                  {e.id === 'emballer' && e.etat === 'afaire' && e.numeros.length > 0 && (
                    <span className="vrm-tr-numeros" data-tournee-numeros={e.numeros.join(',')}>
                      {e.numeros.slice(0, 8).map((n, k) => <span key={n + ':' + k} className="vrm-tr-num">N°{n}</span>)}
                      {e.numeros.length > 8 ? <span className="vrm-tr-num is-plus">+{e.numeros.length - 8}</span> : null}
                      {e.sansNumero > 0 ? <span className="vrm-tr-sans">{e.sansNumero} sans N°</span> : null}
                    </span>
                  )}
                </span>
                <span className="vrm-tr-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ol>
      {nArrets > 0 && (
        <div className="vrm-tr-pied">
          <button type="button" className="vrm-tr-ouvrir" data-tournee-ouvrir="" onClick={onOuvrirTournee}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            Voir la tournée · {plur(nArrets, 'arrêt')}
          </button>
        </div>
      )}
    </section>
  );
}

const lienPlans = (adresse) => `https://maps.apple.com/?q=${encodeURIComponent(adresse)}`;

export function TourneePleinEcran({ arrets = [], C, onFermer, onArret, zIndex = 20000, Retour = null }) {
  React.useEffect(() => {
    const f = (ev) => { if (ev.key === 'Escape') onFermer && onFermer(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
  // La carte : les points relais seulement (avec leur numéro d'arrêt sur l'épingle).
  const groupes = arrets.filter((a) => a.type === 'retrait' && a.point && !a.inconnu).map((a) => ({ ...a.point, numero: a.numero }));
  const nDepots = arrets.filter((a) => a.type === 'depot').length;
  return createPortal(
    <div className="vrm-tr-plein" role="dialog" aria-modal="true" aria-label="Ta tournée" data-tournee-plein="" style={{ zIndex }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-tr-plein-barre">
        <button type="button" className="vrm-tr-fermer" data-tournee-fermer="" aria-label="Fermer la tournée" onClick={onFermer}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <span className="vrm-tr-plein-compte" data-tournee-arrets={arrets.length}>{plur(arrets.length, 'arrêt')}</span>
      </div>
      <div className="vrm-tr-plein-carte">
        {groupes.length > 0
          ? <CarteRelaisColis donnees={{ groupes, enRouteSansRelais: 0 }} C={C} compacte sansListe etiquette={(p) => String(p.numero)}/>
          : <p className="vrm-tr-note" data-tournee-sans-carte="">Aucun point relais à placer sur la carte.</p>}
        {nDepots > 0 && <p className="vrm-tr-note" data-tournee-depots-hors-carte={nDepots}>Les dépôts ne sont pas sur la carte : le point où tu déposes n’est écrit nulle part pour un colis.</p>}
      </div>
      <div className="vrm-tr-plein-feuille">
        <div className="vrm-tr-plein-tete">
          <h2 className="vrm-tr-titre">Ta tournée</h2>
          <span className="vrm-tr-ordre" data-tournee-ordre="limite">par date limite la plus proche — pas un itinéraire</span>
        </div>
        <ol className="vrm-tr-arrets">
          {arrets.map((a) => {
            const quand = texteJours(a.jours, a.type);
            const quoi = a.type === 'depot' ? `déposer ${plur(a.n, 'colis', 'colis')}` : `retirer ${plur(a.n, 'colis', 'colis')}`;
            const nom = a.type === 'depot' ? (a.nom ? `Dépôt ${a.nom}` : 'Dépôt · transporteur pas encore connu') : (a.nom || (a.inconnu ? 'Point pas encore connu' : a.adresse || 'Point relais'));
            return (
              <li key={a.cle} className={'vrm-tr-arret is-' + a.type} data-tournee-arret={a.cle} data-type={a.type} data-numero={a.numero} data-n={a.n} data-jours={a.jours == null ? '' : String(a.jours)}>
                <button type="button" className="vrm-tr-arret-bouton" onClick={() => onArret && onArret(a)}>
                  <span className="vrm-tr-pastille is-arret" aria-hidden="true">{a.numero}</span>
                  <span className="vrm-tr-texte">
                    <span className="vrm-tr-t">{nom}</span>
                    <span className="vrm-tr-s">{[a.type === 'retrait' && a.nom ? a.adresse : '', quoi].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={'vrm-tr-quand' + (a.jours != null && a.jours <= 1 ? ' is-ambre' : '')}>{quand}</span>
                </button>
                {a.type === 'retrait' && a.adresse && a.nom ? <a className="vrm-tr-plans" href={lienPlans(`${a.nom}, ${a.point && a.point.adresse ? a.point.adresse : a.adresse}`)} target="_blank" rel="noopener noreferrer">Ouvrir dans Plans</a> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body
  );
}
