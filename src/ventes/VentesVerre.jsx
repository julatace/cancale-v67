// ════════════════════════════════════════════════════════════════════════════
//  VENTES · « VERRE DÉPOLI » — LES PIÈCES DE L'ÉCRAN (15 nov., maquettes validées)
//  Maquettes : scratchpad maquettes-verre (e-ventes.cjs, kit.cjs) — reprises À
//  L'IDENTIQUE : le segment en verre fumé (À expédier · En route · Toutes), le
//  grand chiffre posé sur le fond, la liste en UN verre (case cochée, photo,
//  plaque N°, site + compte, échéance, emplacement, montant, transporteur), la
//  rangée « Format », le plein « Imprimer les N bordereaux », les quatre étapes
//  d'un colis parti, les étapes de la fiche d'une vente.
//  Ici, SEULEMENT l'habit : aucun nombre n'est calculé, chaque geste est la
//  fonction d'avant passée telle quelle, chaque data-* d'avant est porté par
//  l'appelant (`attrs`). Règles : src/ventesVerre.js. Styles : src/design/ventes-verre.css.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';

const TRAITS = {
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="9.8" r="2.3"/></>,
  printer: <><path d="M7 9V4h10v5"/><path d="M7 17.5H5a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 5 10.5h14a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-2"/><path d="M7 14.5h10V20H7z"/></>,
  check: <path d="M4.5 12.6 9.5 17.5 19.5 7"/>,
  chevron: <path d="m9.5 6 6 6-6 6"/>,
  truck: <><path d="M3 7.5h11v9H3z"/><path d="M14 11h3.6l2.4 2.6v2.9H14z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.4" cy="18" r="1.8"/></>,
  ret: <><path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10H12"/></>,
  chat: <path d="M20.5 11.6c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20.5l1.3-3.5A6.8 6.8 0 0 1 3.5 11.6C3.5 7.6 7.3 4.4 12 4.4s8.5 3.2 8.5 7.2Z"/>,
  store: <><path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5v8.5h13v-8.5"/><path d="M10 20v-4.5h4V20"/></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 12h9"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></>,
  route: <><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></>,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>,
  box: <><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5V20.5"/></>,
};
export function IconeV({ nom, taille = 18, trait = 2, className = '' }) {
  const t = TRAITS[nom];
  if (!t) return null;
  return <svg className={'vv-ic ' + className} width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{t}</svg>;
}

// LE SEGMENT (verre fumé, l'actif en porcelaine) : À expédier · En route · Toutes. `valeur` : 'envoyer' · 'envoyes' · 'toutes'.
// Les data-* d'avant (`data-colis-onglet-choix`) restent sur les deux premiers : les bancs et la coque les touchent.
export function SegmentVentes({ valeur, nEnv, envAmbre = false, nRoute, onChoix }) {
  const opts = [
    { v: 'envoyer', l: tr('vv.seg.expedier'), n: nEnv, ambre: envAmbre && nEnv > 0, data: { 'data-colis-onglet-choix': 'envoyer', 'data-colis-onglet-n': nEnv != null ? String(nEnv) : '' } },
    { v: 'envoyes', l: tr('vv.seg.route'), n: nRoute, data: { 'data-colis-onglet-choix': 'envoyes', 'data-colis-onglet-n': nRoute != null ? String(nRoute) : '' } },
    { v: 'toutes', l: tr('vv.seg.toutes'), n: null, data: {} },
  ];
  return (
    <div className="vv-seg" role="group" aria-label={tr('vv.seg.label')} data-ventes-seg={valeur}>
      {opts.map((o) => (
        <button key={o.v} type="button" className={'vv-seg-b' + (valeur === o.v ? ' is-on' : '')} aria-pressed={valeur === o.v ? 'true' : 'false'}
          data-ventes-seg-choix={o.v} onClick={() => onChoix(o.v)} {...o.data}>
          <span className="vv-seg-l">{o.l}</span>
          {o.n != null && o.n > 0 ? <i className={'vv-seg-n' + (o.ambre ? ' is-ambre' : '')}>{o.n}</i> : null}
        </button>
      ))}
    </div>
  );
}

// LE GRAND CHIFFRE posé sur le fond (« 3 colis à envoyer · bordereaux prêts · cochés pour l'impression »).
// `n` : le nombre PUBLIÉ (null = pas su ⇒ « — », jamais 0). Les data-* d'avant de la tête (`data-sb-tete`,
// `data-sb-chiffre`, `data-sb-presses`) sont gardés : c'est la même tête, autrement habillée.
export function HeroVentes({ id, n, auMoins = '', libelle, sous = null, presses = 0, libellePresses = '', enLecture = '', ronds = null }) {
  return (
    <header className="sb-tete vv-hero" id={id} data-sb-tete="ventes">
      <p className="vv-hero-n" data-sb-chiffre={n == null ? '' : String(n)} data-sb-au-moins={auMoins ? '1' : undefined}>
        {auMoins && n != null ? <span className="vv-hero-borne">{auMoins}</span> : null}
        <bdi className={'sb-chiffre-affiche' + (n == null ? ' is-passu' : '')}>{n == null ? '—' : n}</bdi>
      </p>
      <div className="vv-hero-t">
        <b className="sb-tete-lib">{n == null ? enLecture : libelle}</b>
        {sous || presses > 0 ? <span className="vv-hero-sous">
          {presses > 0 ? <span className="sb-tete-ambre" data-sb-presses={presses}>{libellePresses}</span> : null}
          {presses > 0 && sous ? <span aria-hidden="true">{' · '}</span> : null}
          {sous}
        </span> : null}
      </div>
      {ronds ? <div className="vv-hero-ronds">{ronds}</div> : null}
    </header>
  );
}

// LA CASE À COCHER d'un colis (l'impression en lot). Une vraie case (lecteur d'écran, clavier) ; son toucher
// n'ouvre jamais la fiche de la rangée.
export function CaseCoche({ coche, desactive = false, onBascule, label, attrs = {} }) {
  const stop = (e) => e.stopPropagation();
  return (
    <label className={'vv-coche' + (coche ? ' is-on' : '') + (desactive ? ' is-off' : '')} onClick={stop} onPointerDown={stop} {...attrs}>
      <input type="checkbox" checked={!!coche} disabled={desactive} onChange={() => onBascule && onBascule()} aria-label={label}/>
      <span className="vv-coche-b" aria-hidden="true"><IconeV nom="check" taille={15} trait={3}/></span>
    </label>
  );
}

// L'EMPLACEMENT dans le Stock (« Étagère A · r1 c3 »), lu par le N° (`emplacementDe`). Absent ⇒ rien.
export function texteEmplacement(e, long = false) {
  if (!e) return '';
  const nom = e.nom || tr('vv.ou.meuble');
  return long ? tr('vv.ou.detail', { r: e.rangee, c: e.colonne }) : tr('vv.ou.court', { meuble: nom, r: e.rangee, c: e.colonne });
}
export function Emplacement({ e, attrs = {} }) {
  if (!e) return null;
  return <span className="vv-ou" data-vv-ou={`${e.nom || ''}|${e.rangee}|${e.colonne}`} {...attrs}><IconeV nom="pin" taille={13}/><span>{texteEmplacement(e)}</span></span>;
}

// LE PLEIN de l'écran, en barre (maquette : 52 px, rayon 16, toute la largeur).
export function PleinLarge({ icone = 'printer', libelle, onClick, disabled = false, enCours = false, titre, attrs = {} }) {
  return (
    // (16 nov., Julien : « toute la ligne bouge ») pendant la préparation, le bouton garde son mot et sa taille : la roue
    // tourne DEDANS (`[data-occupe]`, styles-tampons.css).
    <button type="button" className={'sb-btn-plein vv-plein' + (enCours ? ' is-en-cours' : '')} onClick={onClick} disabled={disabled}
      aria-pressed={enCours ? 'true' : undefined} aria-busy={enCours ? 'true' : undefined} data-occupe={enCours ? '' : undefined} title={titre} {...attrs}>
      <IconeV nom={icone} taille={20} trait={1.9}/><span className="sb-btn-plein-mot">{libelle}</span>
    </button>
  );
}

// LES QUATRE ÉTAPES d'un colis parti (Déposé · En transit · Livré · Validé), de `etapesRoute`.
export function EtapesRoute({ etapes, cle }) {
  if (!Array.isArray(etapes)) return null;
  return (
    <ol className="vv-pas4" data-vv-etapes={cle} aria-label={tr('vv.route.etapes')}>
      {etapes.map((e) => (
        <li key={e.cle} className={(e.fait ? 'is-fait' : '') + (e.ici ? ' is-ici' : '')} data-etape={e.cle} data-fait={e.fait ? '1' : '0'}>
          <i aria-hidden="true"/><b>{tr('vv.route.' + e.cle)}</b>
        </li>
      ))}
    </ol>
  );
}

// LES ÉTAPES de la fiche d'une vente (Vendue … Versement), de `etapesFicheVente`. `details` : { cle: texte } (lu).
export function EtapesVente({ etapes, details = {}, libelles = {} }) {
  if (!Array.isArray(etapes)) return null;
  return (
    <div className="vv-stp-liste" data-vv-fiche-etapes="">
      {etapes.map((e) => (
        <div key={e.cle} className={'vv-stp' + (e.fait ? ' is-fait' : '') + (e.ici ? ' is-ici' : '') + (e.geste ? ' is-geste' : '')} data-etape={e.cle} data-fait={e.fait ? '1' : '0'}>
          <i aria-hidden="true">{e.fait ? <IconeV nom="check" taille={11} trait={3.2}/> : null}</i>
          <b>{libelles[e.cle] || tr('vv.fiche.' + e.cle)}</b>
          <span>{details[e.cle] || ''}</span>
        </div>
      ))}
    </div>
  );
}

// « Vendu » et « Pour toi » côte à côte. `pourToi` null ⇒ « — » (pas su, jamais 0).
export function DuoMontants({ vendu, pourToi, frais = null }) {
  return (
    <div className="vv-duo" data-vv-duo="">
      <div className="vv-duo-c"><span>{tr('vv.fiche.vendu')}</span><b data-vv-vendu={vendu || ''}>{vendu || '—'}</b></div>
      <div className="vv-duo-c"><span>{tr('vv.fiche.pourToi')}</span><b data-vv-pour-toi={pourToi || ''}>{pourToi || '—'}</b>{frais ? <small>{frais}</small> : null}</div>
    </div>
  );
}

// LA FICHE D'UNE VENTE (rendue DANS la fiche de la paire ouverte depuis sa rangée, place « contexte ») : qui a vendu et
// à qui (tels que lus), Vendu · Pour toi, les étapes jusqu'au versement, la place dans le Stock et « Je l'ai sortie ».
export function FicheVenteBloc({ site = null, compte = '', acheteur = '', vendu, pourToi, frais = null, etapes, details = {}, emplacement = null, onSortir = null, sortie = false }) {
  return (
    <section className="vv-fiche" data-vv-fiche-vente="">
      {compte || acheteur ? <p className="vv-fiche-qui">{site}<span>{[compte, acheteur ? tr('vv.fiche.acheteur', { pseudo: acheteur }) : ''].filter(Boolean).join(' · ')}</span></p> : null}
      <DuoMontants vendu={vendu} pourToi={pourToi} frais={frais}/>
      {etapes ? <div className="vv-fiche-st"><EtapesVente etapes={etapes} details={details}/></div> : null}
      {emplacement ? (
        <div className="vv-fiche-ou" data-vv-ou={`${emplacement.nom || ''}|${emplacement.rangee}|${emplacement.colonne}`}>
          <span className="vv-tui is-ac"><IconeV nom="pin" taille={19}/></span>
          <span className="vv-fiche-ou-t"><b>{emplacement.nom || tr('vv.ou.meuble')}</b><span>{texteEmplacement(emplacement, true)}</span></span>
          {onSortir ? <button type="button" className="sb-touche vv-touche" data-vv-sortir="" disabled={sortie} onClick={onSortir}>{sortie ? tr('vv.fiche.sortieFaite') : tr('vv.fiche.jeLaiSortie')}</button> : null}
        </div>) : null}
    </section>
  );
}

// Une rangée d'entrée (verre, tuile d'icône, deux lignes, chevron) : « Litiges et retours », « En route », « À renvoyer ».
export function RangeeEntree({ icone, ambre = false, titre, sous, sousAmbre = false, onClick, attrs = {} }) {
  return (
    <button type="button" className="vv-entree" onClick={onClick} {...attrs}>
      <span className={'vv-tui' + (ambre ? ' is-ambre' : '')}><IconeV nom={icone} taille={20} trait={1.9}/></span>
      <span className="vv-entree-mid"><b>{titre}</b>{sous ? <span className={sousAmbre ? 'vv-am' : ''}>{sous}</span> : null}</span>
      <IconeV nom="chevron" taille={16} trait={2.2} className="vv-chev"/>
    </button>
  );
}

// ── (19 nov., Ventes « comme avant ») À L'ORDINATEUR : la liste en tableau ET la fiche de la vente touchée dans un volet à
// droite (maquette validée « ventes-ordi » : la fiche à droite, la liste reste visible). Le seuil est celui du tableau
// (src/ventes/ventes-comme-avant.css) : 1 100 px.
export const MQ_VENTES_GRAND = '(min-width: 1100px)';
export function useGrandEcran() {
  const [grand, setGrand] = React.useState(() => { try { return window.matchMedia(MQ_VENTES_GRAND).matches; } catch (_) { return false; } });
  React.useEffect(() => {
    let mq; try { mq = window.matchMedia(MQ_VENTES_GRAND); } catch (_) { return undefined; }
    const on = () => setGrand(mq.matches);
    try { mq.addEventListener('change', on); } catch (_) { mq.addListener(on); }
    return () => { try { mq.removeEventListener('change', on); } catch (_) { mq.removeListener(on); } };
  }, []);
  return grand;
}

// LE VOLET : ce que la liste sait de la vente touchée (`v`, bâti par la liste avec SES valeurs — rien n'est recalculé ici) :
// la photo, la plaque N°, le site, le titre, « T38 · compte », la fiche de la vente (`v.bloc` : la MÊME que la fiche plein
// écran), ses gestes en touches (jamais un second plein : le plein de l'écran est « Imprimer les N bordereaux ») et
// « Toute la fiche » (la fiche de la paire, avec tous ses gestes). Aucune vente dans la liste ⇒ une phrase.
export function VoletVente({ v, Photo = null, numero = null, logo = null, onFiche = null }) {
  if (!v) return <aside className="vv-volet is-vide" data-vv-volet="" aria-label={tr('vv.volet.label')}><p>{tr('vv.volet.vide')}</p></aside>;
  const Img = Photo || 'img';
  return (
    <aside className="vv-volet" data-vv-volet={v.ident} aria-label={tr('vv.volet.label')}>
      <div className="vv-volet-photo" data-vv-volet-photo={v.photo ? '1' : '0'}>
        {v.photo ? <Img src={v.photo} alt="" loading="lazy" decoding="async"/> : <IconeV nom="box" taille={34} trait={1.5}/>}
      </div>
      <div className="vv-volet-tete">
        {numero || logo ? <p className="vv-volet-l1">{numero}{logo}</p> : null}
        <h2 className="vv-volet-titre">{v.titre}</h2>
        {v.sous ? <p className="vv-volet-sous">{v.sous}</p> : null}
      </div>
      {v.bloc || null}
      {(v.gestes || []).length ? <div className="vv-volet-gestes">
        {v.gestes.map((g) => g.href
          ? <a key={g.cle} className="sb-touche vv-touche" data-vv-volet-geste={g.cle} href={g.href} target="_blank" rel="noreferrer"><IconeV nom={g.icone} taille={17} trait={1.9}/><span>{g.libelle}</span></a>
          : <button key={g.cle} type="button" className="sb-touche vv-touche" data-vv-volet-geste={g.cle} onClick={g.onClick}><IconeV nom={g.icone} taille={17} trait={1.9}/><span>{g.libelle}</span></button>)}
      </div> : null}
      {onFiche ? <button type="button" className="sb-lien vv-volet-fiche" data-vv-volet-fiche="" onClick={onFiche}><span>{tr('vv.volet.fiche')}</span><IconeV nom="chevron" taille={14} trait={2.2}/></button> : null}
    </aside>
  );
}
