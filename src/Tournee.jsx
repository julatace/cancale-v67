// ════════════════════════════════════════════════════════════════════════════
//  LA TOURNÉE — la carte en tête de Ma journée et son mode plein écran (1er nov.)
//  Les étapes et les arrêts viennent de `src/tournee.js` (règle pure) ; cet
//  écran n'en recalcule aucun. Chaque étape ouvre l'écran qui fait le geste
//  (`onEtape`) : impression des prêts, Colis, la colonne « À retirer ».
//  La carte du mode plein écran est le fond de Colis (`FondRelais`), avec les
//  seuls points relais : un point de DÉPÔT n'est relié à un colis par aucune
//  identité, il n'a donc pas d'épingle (jamais devinée).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { useReperes, repereDe, FondRelais, raisonPasSurCarte, codePasSurCarte } from './CarteRelais.jsx';
import { texteJours } from './tournee.js';
import './styles-tournee.css';

const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

function texteEtapeLong(e) {
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

// (1er nov.) LE TEXTE COURT de chaque étape. Julien (1512 px) : « Imprimer 10 b… »,
// « transporteur pa… », « Tabavap 5 · Ph… » — tout était coupé. Un titre qui dit
// le nombre et le geste (« 10 à imprimer »), puis au plus deux lignes courtes :
// deux noms au plus et « +N », le plus pressé. La phrase entière (`texteEtapeLong`)
// reste dans l'infobulle et le nom du bouton. Les nombres sont ceux de l'étape.
const deuxAuPlus = (l, f) => { const v = l.slice(0, 2).map(f); return v.join(' · ') + (l.length > 2 ? ` +${l.length - 2}` : ''); };
// Une ligne ne se coupe qu'APRÈS un « · » ou un « : » — jamais au milieu d'un nom
// (« Mondial / Relay », « Kusmi / Tea ») : chaque morceau reste d'un seul tenant.
// Un morceau long (une phrase) garde ses coupures normales entre les mots.
const morceaux = (l) => String(l).split(/(?<= [·:]) /u).map((m, k, t) => <React.Fragment key={k}><span className={m.length <= 28 ? 'vrm-tr-seg' : undefined}>{m}</span>{k < t.length - 1 ? ' ' : ''}</React.Fragment>);
function texteEtape(e) {
  const L = texteEtapeLong(e);
  if (e.etat === 'passu') return { t: L.t.replace(/ les bordereaux$/, ''), s: [e.id === 'imprimer' && e.auMoins ? 'Colis les lit' : 'Lecture en cours'] };
  if (e.etat === 'rien' || e.etat === 'fait') return { t: e.etat === 'fait' && e.n ? `${e.n} ${{ imprimer: e.n > 1 ? 'imprimés' : 'imprimé', emballer: e.n > 1 ? 'emballés' : 'emballé', deposer: e.n > 1 ? 'déposés' : 'déposé', retirer: e.n > 1 ? 'retirés' : 'retiré' }[e.id]}` : L.t.split(' · ')[0], s: [L.s] };
  const n = e.n == null ? '' : `${e.auMoins ? 'Au moins ' : ''}${e.n} `;
  if (e.id === 'imprimer') {
    const deja = e.n - e.reste;
    return { t: `${n}à imprimer`, s: [deja > 0 ? `${deja} déjà imprimé${deja > 1 ? 's' : ''}` : 'Prêts à imprimer', (e.parTransporteur || []).length ? deuxAuPlus(e.parTransporteur, (x) => `${x.nom} ${x.n}`) : ''].filter(Boolean) };
  }
  if (e.id === 'emballer') {
    const nums = e.numeros || [];
    return { t: `${n}à emballer`, s: [nums.length ? nums.slice(0, 3).map((x) => `N°${x}`).join(' · ') + (nums.length > 3 ? ` +${nums.length - 3}` : '') : 'Aucune n’a encore de N°', e.sansNumero && nums.length ? `${e.sansNumero} sans N°` : ''].filter(Boolean) };
  }
  if (e.id === 'deposer') {
    const d = e.depots || [];
    const presse = d.filter((x) => x.jours != null).sort((a, b) => a.jours - b.jours)[0];
    return { t: `${n}à déposer`, s: [deuxAuPlus(d, (x) => `${x.nom || 'sans transporteur'} ${x.n}`), presse ? { t: `Le plus pressé : ${texteJours(presse.jours, 'depot')}`, ambre: presse.jours <= 1 } : ''].filter(Boolean) };
  }
  const pts = e.points || [];
  const presse = pts.filter((x) => x.jours != null).sort((a, b) => a.jours - b.jours)[0];
  return { t: `${n}à retirer${pts.length > 1 ? ` · ${pts.length} relais` : ''}`, s: [deuxAuPlus(pts, (x) => `${x.nom || 'point pas connu'} ${x.n}`), presse ? { t: `${presse.nom ? presse.nom + ' : ' : ''}${texteJours(presse.jours, 'retrait')}`, ambre: presse.jours <= 1 } : ''].filter(Boolean) };
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
        {nArrets > 0 && (
          <button type="button" className="vrm-tr-ouvrir-lien" data-tournee-ouvrir="" onClick={onOuvrirTournee}>Voir la tournée · {plur(nArrets, 'arrêt')} <span aria-hidden="true">›</span></button>
        )}
      </header>
      <ol className="vrm-tr-etapes">
        {etapes.map((e, i) => {
          const tx = texteEtape(e);
          const lg = texteEtapeLong(e);
          return (
            <li key={e.id} className={'vrm-tr-etape is-' + e.etat} data-tournee-etape={e.id} data-etat={e.etat} data-n={e.n == null ? '' : String(e.n)} data-courante={e.courante ? '1' : undefined}>
              <button type="button" className="vrm-tr-bouton" title={`${lg.t} — ${lg.s}${e.id === 'emballer' && e.numeros.length ? ' : N°' + e.numeros.join(', N°') : ''}`} onClick={() => onEtape && onEtape(e.id)}
                aria-label={`Étape ${i + 1}, ${lg.t}${e.etat === 'fait' ? ', faite' : ''} — ${lg.s}`}>
                <Pastille e={e} i={i}/>
                <span className="vrm-tr-texte">
                  <span className="vrm-tr-t">{e.etat === 'passu' ? <>{tx.t} <span className="vrm-tr-passu">—</span></> : tx.t}</span>
                  {/* Le plus pressé passe en ambre (aujourd'hui, demain ou dépassé) : c'est ce que
                      disait la couleur des cases « À envoyer » / « À retirer » que la Tournée remplace. */}
                  {tx.s.map((l, k) => l && typeof l === 'object'
                    ? <span key={k} className={'vrm-tr-s' + (l.ambre ? ' is-ambre' : '')} data-tournee-presse={l.ambre ? '' : undefined}>{morceaux(l.t)}</span>
                    : <span key={k} className="vrm-tr-s">{morceaux(l)}</span>)}
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
  // La carte : les points relais seulement. (1er nov., Julien : « ça affiche 5
  // points de retrait mais sur la carte il y en a que 3 » puis « il doit y avoir
  // UN point par relais avec le NOMBRE de colis ».) Une épingle par point de
  // retrait, qui porte le nombre de colis à y retirer — le MÊME que la ligne de
  // l'arrêt (`a.n` = `nComptes`, le compte de `vrm_colis_retirer`). Toucher une
  // épingle met la ligne en avant et la fait défiler. Un point qui n'a pas
  // d'épingle le dit sous son arrêt, avec la raison (`raisonPasSurCarte`, la
  // même phrase que Colis) — jamais en silence.
  const retraits = arrets.filter((a) => a.type === 'retrait');
  const connus = retraits.filter((a) => a.point && !a.inconnu);
  const reperes = useReperes(connus.map((a) => a.point), true);
  const [etatFond, setEtatFond] = React.useState('charge');
  const [choisi, setChoisi] = React.useState('');
  const liste = React.useRef(null);
  const epingles = connus.map((a) => {
    const r = repereDe(a.point, reperes);
    // Le nombre de l'épingle = celui de l'arrêt (une seule source).
    return r ? { ...a.point, cle: a.point.cle, lat: r.lat, lon: r.lon, nComptes: a.n } : null;
  }).filter(Boolean);
  const surCarte = new Set(epingles.map((p) => 'r:' + p.cle));
  const raisonHors = (a) => {
    if (a.type !== 'retrait' || surCarte.has(a.cle)) return '';
    return raisonPasSurCarte(a.point && !a.inconnu ? a.point : null, reperes);
  };
  const choisir = (cleRelais) => {
    setChoisi(cleRelais);
    const el = liste.current && [...liste.current.querySelectorAll('[data-tournee-arret]')].find((e) => e.getAttribute('data-tournee-arret') === 'r:' + cleRelais);
    if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { el.scrollIntoView(); } }
  };
  const nHors = retraits.filter((a) => raisonHors(a)).length;
  const nDepots = arrets.filter((a) => a.type === 'depot').length;
  const ko = etatFond === 'ko';
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
        {epingles.length > 0
          ? <FondRelais points={epingles} selection={choisi} onChoisir={choisir} C={C} hauteur={300} onEtat={setEtatFond}/>
          : <p className="vrm-tr-note" data-tournee-sans-carte="">{retraits.length ? 'Aucun point de retrait n’a encore pu être placé sur la carte (la raison est sous chacun).' : 'Aucun point relais à placer sur la carte.'}</p>}
        {epingles.length > 0 && !ko && <p className="vrm-tr-note vrm-tr-credit">Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : Vinted, Base Adresse Nationale.</p>}
        {retraits.length > 0 && epingles.length > 0 && !ko && (
          <p className="vrm-tr-note" data-tournee-retraits-carte={retraits.length - nHors} data-tournee-retraits-hors={nHors}>
            {nHors === 0 ? `${retraits.length > 1 ? `Les ${retraits.length} points` : 'Le point'} de retrait ${retraits.length > 1 ? 'sont' : 'est'} sur la carte, chacun avec son nombre de colis.` : `${retraits.length - nHors} point${retraits.length - nHors > 1 ? 's' : ''} de retrait sur ${retraits.length} sur la carte · ${nHors} pas sur la carte (la raison est sous chacun).`}
          </p>
        )}
        {nDepots > 0 && <p className="vrm-tr-note" data-tournee-depots-hors-carte={nDepots}>Les dépôts n’ont pas d’épingle : le point où tu déposes n’est écrit nulle part pour un colis.</p>}
      </div>
      <div className="vrm-tr-plein-feuille">
        <div className="vrm-tr-plein-tete">
          <h2 className="vrm-tr-titre">Ta tournée</h2>
          <span className="vrm-tr-ordre" data-tournee-ordre="limite">par date limite la plus proche — pas un itinéraire</span>
        </div>
        <ol className="vrm-tr-arrets" ref={liste}>
          {arrets.map((a) => {
            const quand = texteJours(a.jours, a.type);
            const quoi = a.type === 'depot' ? `déposer ${plur(a.n, 'colis', 'colis')}` : `retirer ${plur(a.n, 'colis', 'colis')}`;
            const nom = a.type === 'depot' ? (a.nom ? `Dépôt ${a.nom}` : 'Dépôt · transporteur pas encore connu') : (a.nom || (a.inconnu ? 'Point pas encore connu' : a.adresse || 'Point relais'));
            // Une carte qui ne s'affiche pas ici (pas de WebGL, fond injoignable) : une
            // phrase pour toutes, au-dessus — pas répétée sous chaque arrêt.
            const hors = ko ? '' : raisonHors(a);
            const estChoisi = a.type === 'retrait' && choisi && a.cleRelais === choisi;
            return (
              <li key={a.cle} className={'vrm-tr-arret is-' + a.type + (estChoisi ? ' is-choisi' : '')} data-tournee-arret={a.cle} data-type={a.type} data-numero={a.numero} data-n={a.n} data-jours={a.jours == null ? '' : String(a.jours)}
                data-tournee-sur-carte={a.type === 'retrait' ? (surCarte.has(a.cle) ? 'oui' : 'non') : undefined} data-tournee-choisi={estChoisi ? '1' : undefined}>
                <button type="button" className="vrm-tr-arret-bouton" onClick={() => onArret && onArret(a)}>
                  {/* (1er nov.) Un seul sens pour un nombre sur cet écran : celui des
                      colis. Un retrait porte le nombre de SON épingle (même couleur) ;
                      un dépôt, l'icône d'un colis. L'ordre se lit de haut en bas. */}
                  {a.type === 'retrait'
                    ? <span className={'vrm-tr-pastille is-epingle' + (a.inconnu || !surCarte.has(a.cle) ? ' is-neutre' : '')} data-tournee-pastille={a.n} aria-hidden="true">{a.n}</span>
                    : <span className="vrm-tr-pastille is-depot" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4 8-4M12 12v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></span>}
                  <span className="vrm-tr-texte">
                    <span className="vrm-tr-t">{nom}</span>
                    <span className="vrm-tr-s">{[a.type === 'retrait' && a.nom ? a.adresse : '', quoi].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={'vrm-tr-quand' + (a.jours != null && a.jours <= 1 ? ' is-ambre' : '')}>{quand}</span>
                </button>
                {hors ? <span className="vrm-tr-hors" data-tournee-hors-carte={a.cle} data-raison={a.type === 'retrait' ? codePasSurCarte(a.point && !a.inconnu ? a.point : null, reperes) : undefined}>Pas sur la carte : {hors}.</span> : null}
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
