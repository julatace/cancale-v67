// ── LA FICHE COMPLÈTE D'UNE PAIRE (1er nov., maquette « numero-B-fiche-paire ») ─
// Le parcours de la paire, étape par étape, tel que `parcoursPaire`
// (src/fichePaire.js) l'a lu PAR IDENTITÉ. Une étape lue : à l'encre, pastille
// pleine. Pas su : « — » et la raison. Pas (encore) arrivée : grisée — jamais
// inventée. Aucune couleur (§7) sauf le rouge de deux paires sous ce N° (§5).
import React from 'react';
import { motsVendeur } from './profilVendeur.js';
import {HistoriqueModifications} from './OutilsParcours.jsx';
import { createPortal } from 'react-dom';
import './styles-fiche-paire.css';
import './styles-annonces-outils.css';
import { texteDuree } from './etatArticle.js';
import { escalierPrix, eurosPrix } from './historiquePrix.js';
import { motsInsecables } from './motsInsecables.jsx';
import { tr } from './i18n/index.js';
import { poserSlot } from './ficheLigne.js';

// (14 nov., proposition 62) Ouverte DEPUIS une ligne de liste : ce que la ligne est (le titre de sa partie).
const CLE_CTX = { vente: 'fiche.ctx.vente', colis: 'fiche.ctx.colis', achat: 'fiche.ctx.achat', annonce: 'fiche.ctx.annonce', stock: 'fiche.ctx.stock', retrait: 'fiche.ctx.retrait', journee: 'fiche.ctx.journee' };
// La silhouette d'une basket en trait (une fiche sans photo, état vide illustré — direction « Atelier »).
const Silhouette = () => (
  <svg className="vrm-fp-silhouette" viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 30c0-3 1-6 3-8l9-10c1-1 3-1 4 0l3 3c2 2 5 3 8 3h4c4 0 8 2 11 5l7 5c4 2 7 3 7 6v2H4z"/><path d="M4 33h60M18 14l3 4M23 12l3 4M28 14l2 3"/>
  </svg>
);
// GLISSER POUR FERMER (au doigt) : en haut de la fiche, tirer vers le bas la suit ; relâchée assez loin
// (ou vite), elle se ferme — sinon elle revient, en ressort court. Jamais pendant une saisie, jamais un
// défilement horizontal (raccourcis), jamais quand la fiche est défilée (le doigt défile d'abord).
function useGlisserPourFermer(racine, cadre, fermer) {
  const f = React.useRef(fermer); f.current = fermer;
  React.useEffect(() => {
    const el = racine.current; if (!el) return undefined;
    let g = null;
    const debut = (e) => {
      g = null;
      if (!e.touches || e.touches.length !== 1 || el.scrollTop > 0) return;
      const t = e.target;
      if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],.vrm-fp-raccourcis,[data-noglisse],[role="dialog"]:not(.vrm-fp)')) return;
      g = { y0: e.touches[0].clientY, x0: e.touches[0].clientX, t0: Date.now(), dy: 0, actif: false };
    };
    const bouge = (e) => {
      if (!g || !e.touches || !e.touches[0]) return;
      const dy = e.touches[0].clientY - g.y0, dx = e.touches[0].clientX - g.x0;
      if (!g.actif) {
        if (dy > 10 && dy > Math.abs(dx) * 1.5 && el.scrollTop <= 0) { g.actif = true; g.t0 = Date.now(); }
        else if (Math.abs(dx) > 10 || dy < -6) { g = null; return; }
        else return;
      }
      g.dy = Math.max(0, dy);
      const c = cadre.current; if (c) { c.style.transition = 'none'; c.style.transform = `translateY(${Math.round(g.dy)}px)`; }
      el.setAttribute('data-fiche-glisse', String(Math.round(g.dy)));
    };
    const finir = () => {
      if (!g) return;
      const v = g.dy / Math.max(1, Date.now() - g.t0);
      const ferme = g.actif && (g.dy > 120 || (g.dy > 48 && v > 0.6));
      g = null; el.removeAttribute('data-fiche-glisse');
      const c = cadre.current;
      if (ferme) { f.current(); return; }
      if (c) { c.style.transition = 'transform var(--d-m-ressort, 320ms) var(--d-ressort, cubic-bezier(.32,.72,0,1))'; c.style.transform = ''; }
    };
    el.addEventListener('touchstart', debut, { passive: true });
    el.addEventListener('touchmove', bouge, { passive: true });
    el.addEventListener('touchend', finir);
    el.addEventListener('touchcancel', finir);
    return () => { el.removeEventListener('touchstart', debut); el.removeEventListener('touchmove', bouge); el.removeEventListener('touchend', finir); el.removeEventListener('touchcancel', finir); };
  }, [racine, cadre]);
}

const ICONE = { achat: 'bag', numero: 'pencil', stock: 'home', annonces: 'vitrine', prix: 'tag', offres: 'chat', favoris: 'heart', vente: 'cash', colis: 'box', argent: 'euro', retour: 'restore', benefice: 'chart' };
// (9 nov.) « Ouvrir » : l'écran d'où vient l'étape (`source`, posée par
// `histoireArticle` par identité). Le mot dit OÙ l'on va.
const LIB_SOURCE_ETAPE = { achats: 'Achats', ventes: 'Ventes', cat_bord: 'Colis', compta: 'Compta', cat_annonces: 'Annonces' };
const eur = (c) => (c == null ? '—' : `${(c / 100).toFixed(Number.isInteger(c / 100) ? 0 : 2).replace('.', ',')}\u00a0€`);
const signe = (c) => (c == null ? '—' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${eur(Math.abs(c))}`);
const quand = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
  const d = new Date(t), auj = new Date();
  if (d.toDateString() === auj.toDateString()) return 'auj.';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// (3 nov.) Une ligne d'événement de la chronologie : sa date LUE (sinon « — »),
// son texte, sa preuve, son lien.
const Evenement = ({ ev }) => (
  <li className="vrm-fp-ev" data-fiche-ev={ev.cle} data-fiche-ev-date={ev.at || ''} data-fiche-tx={ev.tx || undefined}>
    {ev.at ? <time dateTime={ev.at}>{quand(ev.at)}</time> : <span className="vrm-fp-ev-sansdate">—</span>}
    <span className="vrm-fp-ev-txt">{ev.lien ? <a href={ev.lien} target="_blank" rel="noopener noreferrer">{ev.texte}</a> : ev.texte}{ev.preuve ? <small data-fiche-preuve="">{ev.preuve}</small> : null}</span>
  </li>
);

// (5 nov.) « VOIR L'ÉTAT » : tout ce qui se calcule sur cet article (le prix
// d'achat est porté par la tuile « Achat » ci-dessus, avec sa source)
// (`etatArticle`, src/etatArticle.js) — deux dates LUES par chiffre, sinon « — »
// et la raison ; « au moins » / « au plus » quand la première mise en ligne est
// plus ancienne que celle qu'on connaît. Aucune couleur (§7).
const LIB_SOURCE = { relie: 'achat relié', gros: 'achat en gros', saisi: 'saisi à la main' };
function EtatArticle({ etat }) {
  const r = etat.republications;
  return (
    <section className="vrm-fp-etat" aria-label="L’état de cet article" data-fiche-etat-article="">
      <h3 className="vrm-fp-etat-titre">L’état</h3>
      <dl className="vrm-fp-etat-grille">
        {etat.lignes.map((l) => (
          <div key={l.cle} className="vrm-fp-etat-l" data-etat-ligne={l.cle} data-etat-val={l.jours == null ? '' : l.jours} data-etat-borne={l.borne || ''}>
            <dt>{l.titre}</dt>
            <dd><b>{texteDuree(l)}</b>{l.jours == null && l.raison ? <small>{l.raison}</small> : /^depuis/.test(l.borne || '') ? <small>pas encore vendue</small> : l.borne === 'au-plus' || l.borne === 'au-moins' ? <small>la 1re annonce n’a pas de date lue</small> : null}</dd>
          </div>
        ))}
        <div className="vrm-fp-etat-l" data-etat-ligne="republications" data-etat-val={r.n == null ? '' : r.n}>
          <dt>Republications</dt>
          <dd><b>{r.n == null ? '—' : r.n}</b><small>{r.n == null ? r.raison : 'vues par VRM'}</small></dd>
        </div>
      </dl>
    </section>
  );
}

// (9 nov., lot AF) L'HISTOIRE DU N° (`historiqueNumero`, src/historiqueNumero.js) : LECTURE
// SEULE — quand et pourquoi ce N° a été posé, changé, quitté, libéré. Chaque ligne vient
// d'une trace qui existe ; ce qui n'en a pas est dit (« origine non enregistrée »), jamais
// deviné. Aucun bouton : rien ici ne change un N°. Aucune couleur (§7).
function HistoireNumero({ h }) {
  return (
    <section className="vrm-fp-histo-num" aria-label="L’histoire de ce N°" data-fiche-histo-num={h.cle} data-n={String(h.evenements.length)} data-origine-connue={h.origineConnue ? '1' : '0'}>
      <h3 className="vrm-fp-etat-titre">L’histoire du N°</h3>
      {h.evenements.length ? (
        <ul className="vrm-fp-evs">
          {h.evenements.map((ev, i) => (
            <li key={i} className="vrm-fp-ev" data-histo-num-ev={ev.quoi} data-histo-num-source={ev.cle} data-histo-num-date={ev.at || ''} data-histo-num-id={ev.id || undefined}>
              {ev.at ? <time dateTime={ev.at}>{dateCourte(ev.at)}</time> : <span className="vrm-fp-ev-sansdate">—</span>}
              <span className="vrm-fp-ev-txt">{ev.texte}{ev.preuve ? <small data-fiche-preuve="">{ev.preuve}</small> : null}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {h.note ? <p className="vrm-fp-note" data-histo-num-note="">{h.note}</p> : null}
    </section>
  );
}
// (10 nov., lot L) L'HISTORIQUE DE PRIX en un coup d'œil : un escalier (le prix tenu
// jusqu'au suivant). Les prix et leurs dates sont dans la liste juste dessous (un nombre
// ne s'écrit pas deux fois, §7). Aucune couleur : l'encre.
function EscalierPrix({ points }) {
  const g = escalierPrix(points);
  if (!g) return null;
  const W = 280, H = 56, P = 4;
  const x = (v) => P + v * (W - 2 * P), y = (v) => H - P - v * (H - 2 * P);
  const d = g.marches.map((m, i) => `${i ? 'L' : 'M'}${x(m.x0).toFixed(1)} ${y(m.y).toFixed(1)} L${x(m.x1).toFixed(1)} ${y(m.y).toFixed(1)}`).join(' ');
  const premier = points[0], dernier = points[points.length - 1];
  return (
    <figure className="vrm-fp-prixserie" data-fiche-prix-serie={points.length} data-prix-premier={premier.prix} data-prix-dernier={dernier.prix} role="img" aria-label={`Prix : de ${eurosPrix(premier.prix)} à ${eurosPrix(dernier.prix)}, ${points.length} prix`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {g.marches.map((m, i) => <path key={i} d={`M${x(m.x0).toFixed(1)} ${y(m.y).toFixed(1)} l0 0`} stroke="currentColor" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
      </svg>
    </figure>
  );
}
const dateCourte = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '—';
  const d = new Date(t);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

export default function FichePaire({ owner = '', p, etat = null, histoNum = null, lecture = false, num, onFermer, onRetour, onBordereau, onEmballer, onPrix, onPrixAchat = null, onDupliquer, onPublierAilleurs, onSource, neuve = null, onCopier, Photo, Icon, Retour, note = null, ligne = null, ligneRes = null, onChoisirNum = null }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  const racine = React.useRef(null), cadre = React.useRef(null);
  useGlisserPourFermer(racine, cadre, onFermer);
  // (14 nov., proposition 62) Les deux places où la LIGNE touchée range ses gestes (src/DansFiche.jsx) :
  // « contexte » (en haut : la vente elle-même) et « actions » (au pouce, sous la carte héros).
  const slotCtx = React.useCallback((el) => poserSlot('contexte', el), []);
  const slotAct = React.useCallback((el) => poserSlot('actions', el), []);
  // (14 nov., AJOUT 3 de Julien) UN SEUL bouton plein accent dans la fiche : l'action principale du contexte
  // (le premier geste « principal » rendu : imprimer, emballer…). Les autres sont des rangées de liste, texte accent.
  React.useEffect(() => {
    const el = racine.current; if (!el || typeof MutationObserver === 'undefined') return undefined;
    const PRINC = '.vrm-fp-b-plein, .vrm-b-primaire, [data-bouton-bord], .vrm-fu-imprimer-ligne, [data-variante="primaire"]';
    const marquer = () => {
      const tous = [...el.querySelectorAll(PRINC)].filter((b) => b.getClientRects().length);
      const p = tous[0] || null;
      el.querySelectorAll('[data-fiche-principal]').forEach((b) => { if (b !== p) b.removeAttribute('data-fiche-principal'); });
      if (p && !p.hasAttribute('data-fiche-principal')) p.setAttribute('data-fiche-principal', '');
    };
    marquer();
    const mo = new MutationObserver(() => marquer());
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  if (typeof document === 'undefined') return null;
  const I = (n, s = 18) => (Icon ? <Icon name={n} size={s}/> : null);
  const r = p && p.resume;
  const depuis = ligne && ligne.cle ? ligne : null;
  const ctx = depuis ? depuis.contexte : '';
  // (13 nov., point 14) « Saisir le prix d'achat » : seulement sur une fiche connue (l'écriture va sur ELLE).
  const saisir = p && onPrixAchat && p.idFiche && !p.ancienNumero && r && r.achat == null ? () => onPrixAchat(p) : null;
  const sv = r && r.siVendue ? r.siVendue : null;
  // ⚠️ §5 : deux paires PRÉSENTES sous ce N° — la fiche le dit en rouge et NE CHOISIT PAS : aucun
  // chiffre d'une des deux (achat, bénéfice, état) n'est montré comme celui « de la paire ».
  const double = !!(p && p.double);
  // LA CARTE HÉROS (direction « Atelier ») : la photo (celle de la paire lue par identité, sinon celle de la
  // LIGNE touchée), le N° en affiche, le titre, le prix à l'encre. Une ligne sans paire : « Sans N° ».
  const photoHeros = (p && p.photo) || (depuis && depuis.photo) || '';
  const prixHeros = (depuis && depuis.prix) || (!double && sv && sv.prix != null ? eur(sv.prix) : !double && r && r.vente != null ? eur(r.vente) : '');
  const titreHeros = p ? ((neuve && neuve.titre) || p.titre || (p.etat === 'rien' ? 'N° jamais servi' : 'Sans titre')) : ((depuis && depuis.titre) || tr('fiche.sansTitre'));
  const tailleHeros = p ? ((neuve && neuve.taille) || p.taille || '') : '';
  const sousHeros = [ctx ? tr(CLE_CTX[ctx] || 'fiche.ctx.vente') : '', depuis && depuis.sous ? depuis.sous : ''].filter(Boolean).join(' · ');
  const heros = (p || depuis) ? (
    <section className={'vrm-fp-heros vrm-fp-entete' + (photoHeros ? ' a-photo' : ' is-sans-photo')} data-fiche-heros={ctx || 'numero'} data-fiche-photo-vedette={photoHeros ? '1' : '0'} aria-label={tr('fiche.heros')}>
      <span className="vrm-fp-heros-photo vrm-fp-photo" data-fiche-heros-photo={photoHeros ? '1' : '0'}>{photoHeros && Photo ? Photo(photoHeros) : <Silhouette/>}</span>
      <span className="vrm-fp-quoi">
        {sousHeros ? <span className="vrm-fp-heros-ctx" data-fiche-heros-ctx="">{sousHeros}</span> : null}
        {p ? <span className={'vrm-fp-num' + (double ? ' is-double' : '')} data-fiche-grand-num="">{p.num}</span>
          : <span className="vrm-fp-num is-sans" data-fiche-grand-num="" data-fiche-sans-num="">{ligneRes && ligneRes.etat === 'lot' ? tr('fiche.lotN', { n: String(ligneRes.nums.length) }) : tr('fiche.sansNum')}</span>}
        <span className="vrm-fp-titre">{motsInsecables(titreHeros)}{tailleHeros ? ` · ${tailleHeros}` : ''}</span>
        {neuve ? <span className="vrm-fp-sous" data-fiche-neuve="">Photos à prendre</span> : null}
        {p && p.ancienNumero ? <span className="vrm-fp-sous">Ancien numéro (d’avant la remise à zéro)</span> : null}
        {prixHeros ? <span className="vrm-fp-heros-prix" data-fiche-heros-prix={prixHeros}>{prixHeros}</span> : null}
      </span>
    </section>
  ) : null;
  // La fiche de la LIGNE seule (aucune paire désignée par identité) : jamais une paire devinée.
  const sansPaire = !p && depuis ? (
    <section className="vrm-fp-sans-paire" data-fiche-sans-paire={ligneRes ? ligneRes.etat : 'aucun'} role="note">
      {ligneRes && ligneRes.etat === 'lot' ? <>
        <p className="vrm-fp-sans-paire-t">{tr('fiche.lotTitre', { n: String(ligneRes.nums.length) })}</p>
        <div className="vrm-fp-lot" data-fiche-lot={ligneRes.nums.join(',')}>
          {ligneRes.nums.map((n) => <button key={n} type="button" className="vrm-fp-b" data-fiche-lot-num={n} onClick={() => onChoisirNum && onChoisirNum(n)}>N°{n}</button>)}
        </div>
      </> : ligneRes && ligneRes.etat === 'lecture' ? <p className="vrm-fp-sans-paire-t" data-fiche-lecture="">{tr('fiche.lecture')}</p>
        : ligneRes && ligneRes.etat === 'passu' ? <p className="vrm-fp-sans-paire-t">— {tr('fiche.passu')}</p>
        : <>
          <p className="vrm-fp-sans-paire-t">{tr('fiche.pasDePaire')}</p>
          <p className="vrm-fp-sans-paire-g" data-fiche-geste-relier="">{tr('fiche.gesteRelier.' + (ctx === 'achat' ? 'achat' : ctx === 'annonce' ? 'annonce' : 'vente'))}</p>
        </>}
    </section>
  ) : null;
  // Les gestes de la fiche elle-même ; ouverte depuis une ligne, ils rejoignent ceux de la ligne dans « Actions ».
  const outils = p && (onPrix || onDupliquer || onPublierAilleurs) && !p.ancienNumero ? (<>
    {onPrix && !neuve ? <button type="button" className="vrm-ao-second" data-fiche-prix="" onClick={() => onPrix(p.num)}>Changer le prix</button> : null}
    {onPublierAilleurs && !neuve && p.etat !== 'rien' ? <button type="button" className="vrm-ao-second" data-fiche-publier-ailleurs="" onClick={() => onPublierAilleurs(p.num)}>Publier ailleurs</button> : null}
    {onDupliquer && p.etat !== 'rien' ? <button type="button" className="vrm-ao-second" data-fiche-dupliquer="" onClick={() => onDupliquer(p.num)}>Dupliquer</button> : null}
    {neuve && onCopier ? <button type="button" className="vrm-ao-second" data-fiche-copier="" onClick={() => onCopier(neuve)}>Copier le texte</button> : null}
  </>) : null;
  const poster = p && p.aPoster && (onBordereau || onEmballer) ? (
    <div className="vrm-fp-actions">
      {onBordereau ? <button type="button" className="vrm-fp-b" data-fiche-bordereau={p.txAPoster} onClick={() => onBordereau(p.txAPoster)}>{I('printer')}Bordereau</button> : null}
      {onEmballer ? <button type="button" className="vrm-fp-b vrm-fp-b-plein" data-fiche-emballer="" onClick={onEmballer}>{I('box')}Emballer</button> : null}
    </div>
  ) : null;
  const actions = depuis ? (
    <section className="vrm-fp-actions-sec" data-fiche-actions={ctx} aria-label={tr('fiche.actions')}>
      <h3 className="vrm-fp-etat-titre">{tr('fiche.actions')}</h3>
      <div className="vrm-fp-actions-carte">
        <div className="vrm-fp-actions-ligne" ref={slotAct} data-fiche-actions-ligne=""/>
        {outils ? <div className="vrm-fp-outils">{outils}</div> : null}
        {poster}
      </div>
    </section>
  ) : null;
  const histoire = p ? (
    <>
      {/* (10 nov., lot BD) La note privée de la paire (l'écran la fournit : NotePaireCoque). */}
      {note ? <div className="vrm-fp-note-privee" data-fiche-note="">{note}</div> : null}
      {double ? <p className="vrm-fp-double" role="alert" data-fiche-double="1" data-fiche-choisit="0">Deux {motsVendeur().noms} présent{motsVendeur().e}s portent le N°{p.num} : vérifie là où {motsVendeur().elle}s sont rangé{motsVendeur().e}s avant d’emballer ou d’imprimer.</p> : null}
      {double ? null : <div className="vrm-fp-tuiles">
        {/* (5 nov.) Le prix d'achat de « Voir l'état » est CE nombre (jamais écrit deux fois, §7) : sa source dessous. */}
        <div className={'vrm-fp-tuile' + (r.achat == null ? ' is-manque' : '')} data-fiche-resume-achat={r.achat == null ? '' : r.achat} {...(etat ? { 'data-etat-ligne': 'prix-achat', 'data-etat-val': etat.prixAchat.cents == null ? '' : etat.prixAchat.cents, 'data-etat-source': etat.prixAchat.source || '' } : {})}>
          <span>Achat</span><b className={r.achat == null ? 'is-vide' : undefined}>{eur(r.achat)}</b>
          {/* (13 nov., point 14) Le chiffre qui manque est la porte pour le corriger (§5) : « Saisir » ; la tuile
              du bénéfice, à côté, NOMME le manque (« prix d'achat pas saisi ») — une porte, pas deux. */}
          {r.achat == null && saisir ? <button type="button" className="vrm-lien-action vrm-fp-saisir" data-fiche-saisir-achat={p.idFiche} onClick={saisir}>Saisir</button>
            : etat ? <small>{etat.prixAchat.cents == null ? etat.prixAchat.raison : LIB_SOURCE[etat.prixAchat.source]}</small> : null}
        </div>
        {sv ? (<>
          {/* (13 nov., point 14) PAS ENCORE VENDUE : le prix affiché, et le bénéfice SI elle se vend à ce prix
              (la même règle que la vente, src/dormantes.js). Ce n'est pas un bénéfice : aucun « Bénéfice » écrit. */}
          <div className={'vrm-fp-tuile' + (sv.prix == null ? ' is-manque' : '')} data-fiche-resume-vente="" data-fiche-prix-affiche={sv.prix == null ? '' : sv.prix}><span>En ligne à</span><b className={sv.prix == null ? 'is-vide' : undefined}>{eur(sv.prix)}</b></div>
          <div className={'vrm-fp-tuile' + (sv.benefice == null ? ' is-manque' : '')} data-fiche-resume-benefice="" data-fiche-si-vendue={sv.benefice == null ? '' : sv.benefice} data-fiche-si-vendue-etat={sv.etat} data-fiche-benefice-partiel={sv.etat === 'partiel' ? '1' : undefined}>
            <span>Si vendue</span><b className={sv.benefice == null ? 'is-vide' : undefined}>{signe(sv.benefice)}</b>
            {sv.benefice == null ? <small data-fiche-raison-benef="">{sv.raison}</small>
              : <small>{sv.etat === 'partiel' ? 'au plus : frais à confirmer' : 'tous frais comptés'}</small>}
          </div>
        </>) : (<>
          <div className={'vrm-fp-tuile' + (r.vente == null ? ' is-manque' : '')} data-fiche-resume-vente={r.vente == null ? '' : r.vente}><span>{r.venteLib || 'Vente'}</span><b className={r.vente == null ? 'is-vide' : undefined}>{eur(r.vente)}</b></div>
          <div className={'vrm-fp-tuile' + (r.benefice == null ? ' is-manque' : '')} data-fiche-resume-benefice={r.benefice == null ? '' : r.benefice} data-fiche-benefice-partiel={r.benefPartiel ? '1' : undefined}>
            <span>Bénéfice</span><b className={r.benefice == null ? 'is-vide' : undefined}>{signe(r.benefice)}</b>
            {r.benefice == null && r.raisonBenef ? <small data-fiche-raison-benef="">{r.raisonBenef}</small> : r.benefPartiel ? <small>frais pas tous confirmés</small> : null}
          </div>
        </>)}
      </div>}
      {etat && !double ? <EtatArticle etat={etat}/> : null}
      {!depuis && outils ? <div className="vrm-fp-outils">{outils}</div> : null}
      <nav className="vrm-fp-raccourcis" aria-label="Rubriques de cet article">{p.etapes.map(e=><button key={e.cle} type="button" onClick={()=>document.getElementById(`vrm-fiche-etape-${e.cle}`)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})}>{e.titre}</button>)}</nav>
      {histoNum ? <HistoireNumero h={histoNum}/> : null}
      <HistoriqueModifications owner={owner} numero={p.num}/>
      <ol className="vrm-fp-parcours">
        {p.etapes.map((e) => (
          <li key={e.cle} id={`vrm-fiche-etape-${e.cle}`} className={'vrm-fp-etape is-' + e.etat} data-fiche-etape={e.cle} data-fiche-etat={e.etat}>
            <span className="vrm-fp-pastille" aria-hidden="true">{I(ICONE[e.cle] || 'info', 17)}</span>
            <span className="vrm-fp-txt">
              <span className="vrm-fp-ligne1"><b>{e.titre}</b>{e.date ? <time className="vrm-fp-date" dateTime={e.date}>{quand(e.date)}</time> : null}</span>
              {e.lignes ? e.lignes.map((l, j) => <span key={j} className="vrm-fp-detail" data-fiche-ligne={l.site} data-fiche-tx={l.tx || undefined}>{l.texte}{l.date && e.cle === 'vente' && e.lignes.length > 1 ? ` · ${quand(l.date)}` : ''}</span>) : null}
              {e.cle === 'prix' && Array.isArray(e.serie) && e.serie.length > 1 ? <EscalierPrix points={e.serie}/> : null}
              {e.evenements && e.evenements.length ? <ul className="vrm-fp-evs">{e.evenements.map((ev, j) => <Evenement key={j} ev={ev}/>)}</ul> : null}
              {e.detail ? <span className="vrm-fp-detail">{e.etat === 'passu' ? <>— <span data-fiche-raison="">{e.detail}</span></> : e.detail}</span> : null}
              {e.source && onSource ? <button type="button" className="vrm-lien-action vrm-fp-source" data-fiche-source={e.cle} data-fiche-source-tab={e.source.stock ? 'garage' : e.source.tab} onClick={() => onSource(e.source)}>{e.source.stock ? 'Voir au Stock' : `Ouvrir dans ${LIB_SOURCE_ETAPE[e.source.tab] || 'l’écran'}`} ›</button> : null}
            </span>
          </li>
        ))}
      </ol>
      {lecture ? <p className="vrm-fp-note" data-fiche-lecture="">Lecture en cours…</p>
        : p.manques.length ? <p className="vrm-fp-note" data-fiche-manques={p.manques.length}>Pas pu lire : {p.manques.join(', ')}.</p> : null}
      {!depuis ? poster : null}
    </>
  ) : null;
  const nomFiche = (p && p.num) || num || '';
  return createPortal(
    <div ref={racine} className={'vrm-fp' + (depuis ? ' is-depuis-ligne' : '')} role="dialog" aria-modal="true" aria-label={nomFiche ? `Tout sur le N°${nomFiche}` : tr('fiche.heros')} data-fiche-paire={nomFiche} data-fiche-contexte-ouvert={ctx || undefined}
      data-fiche-ligne-cle={depuis ? depuis.cle : undefined} data-fiche-identite={depuis ? (ligneRes ? ligneRes.etat + ':' + (ligneRes.par || '') : '') : 'numero'} data-fiche-lecture-en-cours={lecture ? '1' : '0'} data-noswipe="1">
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-fp-cadre" ref={cadre}>
        <span className="vrm-fp-poignee" aria-hidden="true"/>
        <header className="vrm-fp-tete">
          <button type="button" className="vrm-fp-retour" data-fiche-retour="" onClick={onRetour || onFermer}><svg aria-hidden="true" className="vrm-fp-chevron" viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>{depuis ? tr('fiche.retour') : 'Tout sur le N°'}</button>
          <button type="button" className="vrm-fp-fermer" aria-label="Fermer la fiche" data-fiche-fermer="" onClick={onFermer}>{I('close', 20) || '×'}</button>
        </header>
        {!p && !depuis ? <p className="vrm-fp-vide" data-fiche-vide="">{lecture ? `Je lis l’histoire de ${motsVendeur().ce}…` : `Le N°${num} n’est pas un numéro.`}</p> : null}
        {heros}
        {sansPaire}
        {/* (14 nov., proposition 62) La partie utile au contexte, EN HAUT : la vente touchée (son récapitulatif) ;
            puis les gestes de la ligne et de la fiche, au pouce ; l'histoire de la paire dessous. */}
        {depuis ? <section className="vrm-fp-contexte" data-fiche-contexte={ctx} aria-label={tr(CLE_CTX[ctx] || 'fiche.ctx.vente')} ref={slotCtx}/> : null}
        {actions}
        {histoire}
      </div>
    </div>, document.body);
}
