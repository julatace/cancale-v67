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
import MarquePlateforme from './plateformes/Marque.jsx';   // (15 nov., verre 2) la ligne par site
import { BeneficeArticleDetail } from './BeneficeArticle.jsx';   // (15 nov., lot argent-plus) le bénéfice réel, frais du site inclus
import { poserSlot } from './ficheLigne.js';
import LigneDeTemps, { OngletsFiche, useVueFiche } from './paireHistoire/LigneDeTemps.jsx';   // (14 nov., idée 154) « Dans l'ordre »
// (15 nov., direction D « fiche produit ») la règle de rangement (pure) et sa matière.
import { vueInitiale, ligneEtat, actionFiche, argentFiche, histoireFiche, tuilesFiche } from './ficheProduit.js';

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
    <span className="vrm-fp-ev-txt">{ev.lien ? <a href={ev.lien} target="_blank" rel="noopener noreferrer">{ev.texte}</a> : ev.texte}{ev.preuve ? <small data-fiche-preuve={ev.preuve} hidden/> : null}</span>
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
  // (16 nov., captures de Julien) « achat pas relié à cette paire » sous deux chiffres : une même phrase sur plusieurs
  // lignes est UNE phrase, dite une fois sous le titre (§7) ; les lignes gardent leur « — ».
  const nbRaison = new Map();
  for (const l of etat.lignes) if (l.jours == null && l.raison) nbRaison.set(l.raison, (nbRaison.get(l.raison) || 0) + 1);
  const communes = [...nbRaison].filter(([, n]) => n > 1).map(([t]) => t);
  return (
    <section className="vrm-fp-etat" aria-label="L’état de cet article" data-fiche-etat-article="">
      <h3 className="vrm-fp-etat-titre">L’état</h3>
      {communes.map((t) => <p key={t} className="vrm-fp-etat-commune" data-etat-raison-commune="">— {t}</p>)}
      <dl className="vrm-fp-etat-grille">
        {etat.lignes.map((l) => (
          <div key={l.cle} className="vrm-fp-etat-l" data-etat-ligne={l.cle} data-etat-val={l.jours == null ? '' : l.jours} data-etat-borne={l.borne || ''}>
            <dt>{l.titre}</dt>
            <dd><b>{texteDuree(l)}</b>{l.jours == null && l.raison ? (communes.includes(l.raison) ? null : <small>{l.raison}</small>) : /^depuis/.test(l.borne || '') ? <small>pas encore vendue</small> : l.borne === 'au-plus' || l.borne === 'au-moins' ? <small>la 1re annonce n’a pas de date lue</small> : null}</dd>
          </div>
        ))}
        <div className="vrm-fp-etat-l" data-etat-ligne="republications" data-etat-val={r.n == null ? '' : r.n}>
          <dt>Republications</dt>
          <dd><b>{r.n == null ? '—' : r.n}</b>{r.n == null ? <small>{r.raison}</small> : null}</dd>
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
              <span className="vrm-fp-ev-txt" title={ev.preuve || undefined}>{ev.texte}{ev.preuve ? <small data-fiche-preuve={ev.preuve} hidden/> : null}</span>
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
// Ordinateur (la même borne que le téléphone de src/ui/AFaire.jsx, inversée).
const planOrdinateur = () => { try { return window.matchMedia('(min-width: 768px)').matches; } catch (_) { return false; } };
const dateCourte = (iso) => {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '—';
  const d = new Date(t);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

// (15 nov., direction D « fiche produit », choisie par Julien — docs/passation/2026-11-15-fiche-d.md) Les morceaux de la
// fiche en UN écran : la règle de rangement est src/ficheProduit.js (pure) ; ici, seulement le rendu.
const eurFd = (c) => (c == null ? '?' : eur(c));
const signeFd = (c) => (c == null ? '?' : signe(c));
const NOM_SITE_FD = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const dateFd = (t) => { const d = new Date(t); if (!Number.isFinite(d.getTime())) return ''; return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
const prixFd = (c) => (c == null ? '' : eur(c));
// Un rond sur la photo (‹ et ⋯) : 44 px, verre sombre (maquette `.rd3`).
const Rond = ({ children, className = '', ...p }) => <button type="button" className={'fd-rond ' + className} {...p}>{children}</button>;
const ICONE_TUILE = { note: 'pencil', photos: 'camera', certificat: 'doc', rappel: 'clock', prix: 'tag', publier: 'shop', dupliquer: 'copy', taille: 'grid', bordereau: 'printer', emballer: 'box', numero: 'journal' };
const MarqueSite = (site, I) => (['vinted', 'ebay', 'leboncoin', 'vestiaire'].includes(site) ? <MarquePlateforme site={site} taille={site === 'ebay' ? 11 : 18}/> : I('tag', 17));

// LA CARTE D'ACTION (la seule chose à faire maintenant).
function CarteAction({ a, I, Photo, relier, onBordereau, onPrix, onSaisir, num }) {
  if (!a) return null;
  if (a.sorte === 'relier') {
    const pr = a.proposition;
    const lit = pr === undefined;
    const achat = pr && pr.achat;
    const d = pr && Number.isFinite(pr.recuMs) ? dateFd(pr.recuMs) : achat && achat.date ? dateFd(Date.parse(achat.date)) : '';
    const autre = () => relier && relier.onAutre && relier.onAutre();
    return (
      <section className="fd-act is-am" data-fd-action="relier" data-fd-propose={pr ? String(pr.tx || '') : lit ? 'lecture' : ''} aria-label={tr('fd.relier.titre')}>
        <b className="fd-act-t">{tr('fd.relier.titre')}</b>
        {pr ? (<>
          <div className="fd-act-p" data-fd-achat-propose={String(pr.tx || '')} data-fd-achat-niveau={pr.niveau || ''}>
            <span className="fd-act-ph">{achat && achat.photo && Photo ? Photo(achat.photo) : <Silhouette/>}</span>
            <span className="fd-act-pt"><b>{motsInsecables(pr.titre || (achat && achat.title) || '')}</b>
              <span>{[d ? tr(pr.recuMs != null ? (pr.recuSource === 'livraison' ? 'fd.relier.livreeLe' : 'fd.relier.retireeLe') : 'fd.relier.commandeeLe', { date: d }) : '', pr.texte ? tr('fd.relier.payee', { prix: pr.texte }) : ''].filter(Boolean).join(' · ')}</span></span>
          </div>
          <button type="button" className="fd-plein sb-btn-plein" data-fd-relier={String(pr.tx || '')} data-fd-relier-cents={pr.centimes == null ? '' : String(pr.centimes)} onClick={() => relier && relier.onRelier && relier.onRelier(pr)}>{I('link', 19)}{pr.texte ? tr('fd.relier.plein', { prix: pr.texte }) : tr('fd.relier.pleinSansPrix')}</button>
          <button type="button" className="fd-lien" data-fd-relier-autre="" onClick={autre}>{tr('fd.relier.autre')}</button>
        </>) : (<>
          <span className="fd-act-s" data-fd-relier-etat={lit ? 'lecture' : 'aucun'}>{tr(lit ? 'fd.relier.cherche' : 'fd.relier.aucun')}</span>
          {lit ? <button type="button" className="fd-lien" data-fd-relier-autre="" onClick={autre}>{tr('fd.relier.autre')}</button>
            : <button type="button" className="fd-plein sb-btn-plein" data-fd-relier-autre="" onClick={autre}>{I('link', 19)}{tr('fd.relier.choisir')}</button>}
        </>)}
      </section>
    );
  }
  if (a.sorte === 'bordereau') return (
    <section className="fd-act" data-fd-action="bordereau" aria-label={tr('fd.bord.titre')}>
      <b className="fd-act-t">{tr('fd.bord.titre')}</b>
      {a.pret ? <span className="fd-act-s">{tr('fd.bord.pret')}</span> : null}
      <button type="button" className="fd-plein sb-btn-plein" data-fiche-bordereau={a.tx || ''} onClick={() => onBordereau && onBordereau(a.tx)}>{I('printer', 19)}{tr('fd.bord.plein')}</button>
    </section>
  );
  if (a.sorte === 'baisser') {
    const t = a.jours != null ? (a.offres === 0 ? tr('fd.baisser.aucuneOffre', { n: a.jours }) : a.offres ? tr('fd.baisser.offres', { n: a.offres, j: a.jours }) : tr('fd.baisser.depuis', { n: a.jours })) : tr('fd.baisser.titre');
    return (
      <section className="fd-act" data-fd-action="baisser" aria-label={t}>
        <b className="fd-act-t">{t}</b>
        {a.favoris != null ? <span className="fd-act-s">{tr('fd.baisser.favoris', { n: a.favoris })}</span> : null}
        <button type="button" className="fd-plein sb-btn-plein" data-fiche-prix="" data-fd-baisser={num} onClick={() => onPrix && onPrix(num)}>{I('tag', 19)}{tr('fd.baisser.plein')}</button>
      </section>
    );
  }
  if (a.sorte === 'saisir') return (
    <section className="fd-act is-am" data-fd-action="saisir" aria-label={tr('fd.saisir.titre')}>
      <b className="fd-act-t">{tr('fd.saisir.titre')}</b>
      <button type="button" className="fd-plein sb-btn-plein" data-fiche-saisir-achat="" onClick={onSaisir}>{I('pencil', 19)}{tr('fd.saisir.plein')}</button>
    </section>
  );
  return null;
}

// LA VUE « ARGENT » : deux chiffres, chacun une fois (les data-* d'avant gardés).
// (16 nov., relier-fiable — Julien : « ici j'ai mal relié un achat, je veux pouvoir l'enlever, et tu peux mettre le
// justificatif d'achat à côté ») À côté de « Achetée », l'achat RELIÉ (par son n° de transaction) : « Reçu » (le reçu de
// CET achat — e-mail Vinted, sinon l'attestation tirée de l'achat lu) ou « Pas de reçu » (jamais un lien mort), et
// « Délier » (confirmé, annulable). `lien` : { tx, recu: undefined (lecture) | true | false, onRecu, onDelier }.
function GestesAchatRelie({ lien }) {
  if (!lien || !lien.tx) return null;
  return (
    <span className="fd-arg-gestes" data-fd-achat-relie={lien.tx}>
      {lien.recu === true ? <button type="button" className="fd-lien fd-arg-g" data-fd-recu={lien.tx} onClick={lien.onRecu}>{tr('fd.argent.recu')}</button>
        : lien.recu === false ? <small className="fd-arg-n" data-fd-pas-recu="">{tr('fd.argent.pasRecu')}</small> : null}
      <button type="button" className="fd-lien fd-arg-g" data-fd-delier={lien.tx} onClick={lien.onDelier}>{tr('fd.argent.delier')}</button>
    </span>
  );
}
function VueArgent({ cases, etat, lien = null }) {
  if (!cases.length) return null;
  const grand = cases.some((c) => c.gros);
  return (
    <div className={'fd-arg' + (grand ? ' is-grand' : '')} data-fd-vue-argent={cases.map((c) => c.cle).join(',')}>
      {cases.map((c) => {
        const attrs = c.cle === 'achat' ? { 'data-fiche-resume-achat': c.cents == null ? '' : c.cents, ...(etat ? { 'data-etat-ligne': 'prix-achat', 'data-etat-val': etat.prixAchat.cents == null ? '' : etat.prixAchat.cents, 'data-etat-source': etat.prixAchat.source || '' } : {}) }
          : c.cle === 'benefice' ? { 'data-fiche-resume-benefice': c.cents == null ? '' : c.cents, 'data-fiche-benefice-partiel': c.partiel ? '1' : undefined }
          : { 'data-fiche-resume-benefice': '', 'data-fiche-si-vendue': c.cents == null ? '' : c.cents, 'data-fiche-benefice-partiel': c.partiel ? '1' : undefined };
        return (
          <div key={c.cle} className={'fd-arg-c' + (c.gros ? ' is-gros' : '') + (c.cents == null ? ' is-manque' : '')} {...attrs}>
            <span>{tr(c.lib)}</span>
            <b className={'num' + (c.cents == null && c.ambre ? ' is-am' : '')} title={c.cents == null && c.raison ? c.raison : undefined}>{c.signe ? signeFd(c.cents) : eurFd(c.cents)}</b>
            {c.cents == null && c.raison ? <small className="vg-sr" data-fiche-raison-benef="">{c.raison}</small> : c.partiel ? <small className="fd-arg-n">{tr('fd.argent.auPlus')}</small> : null}
            {c.cle === 'achat' && c.cents != null ? <GestesAchatRelie lien={lien}/> : null}
          </div>
        );
      })}
    </div>
  );
}

// LA VUE « SITES » : une rangée par site (en ligne, ou la vente), son compte, son prix ou ce qui s'y passe.
function VueSites({ sites, I }) {
  if (!sites.length) return <p className="fd-vide" data-fd-sites="0">{tr('fd.sites.aucun')}</p>;
  // Chaque info UNE fois : un prix partout le même est déjà dans la ligne d'état — la rangée ne le redit pas.
  const enL = sites.filter((s) => s.etat === 'en-ligne');
  const memePrix = enL.length > 0 && enL.every((s) => s.prix != null && s.prix === enL[0].prix);
  return (
    <div className="fd-sites" data-fd-sites={sites.length} data-fiche-sites={sites.length}>
      {sites.map((s, i) => (
        <div key={i} className="fd-site" data-fiche-site={s.site} data-fiche-site-etat={s.etat}>
          <span className="fd-site-logo" aria-hidden="true">{MarqueSite(s.site, I)}</span>
          <span className="fd-site-txt"><b>{NOM_SITE_FD[s.site] || s.site}{s.compte ? ` · ${s.compte}` : ''}</b>
            <span>{s.etat === 'vendue' ? [s.date ? tr('fd.sites.vendueLe', { date: dateFd(s.date) }) : tr('fd.sites.vendue'), prixFd(s.prix)].filter(Boolean).join(' · ')
              : [memePrix ? '' : prixFd(s.prix), Number.isFinite(s.favoris) ? tr('fd.sites.favoris', { n: s.favoris }) : ''].filter(Boolean).join(' · ') || tr('fd.sites.enLigne')}</span></span>
        </div>
      ))}
    </div>
  );
}

// LA VUE « HISTOIRE » : quatre ou cinq lignes, un point par étape.
function VueHistoire({ lignes }) {
  if (!lignes.length) return <p className="fd-vide">{tr('fd.h.vide')}</p>;
  return (
    <ol className="fd-hist" data-fiche-hist={lignes.length}>
      {lignes.map((l) => {
        const d = l.at != null ? dateFd(l.at) : '';
        const reste = [d, l.montant != null ? eur(l.montant) : '', l.compte || '', l.sites && l.sites.length ? l.sites.map((x) => NOM_SITE_FD[x] || x).join(', ') : '', l.detail ? tr(l.detail, { n: l.n }) : ''].filter(Boolean).join(' · ');
        return <li key={l.cle} className={'fd-hist-l' + (l.ton ? ' is-' + l.ton : '')} data-fiche-hist-etape={l.cle}><i aria-hidden="true"/><b>{l.libre || tr(l.titre)}</b>{reste ? <span>{reste}</span> : null}</li>;
      })}
    </ol>
  );
}

export default function FichePaire({ owner = '', p, etat = null, histoNum = null, lecture = false, num, onFermer, onRetour, onBordereau, onEmballer, onPrix, onPrixAchat = null, onDupliquer, onPublierAilleurs, onSource, neuve = null, onCopier, Photo, Icon, Retour, note = null, plus = null, sites = null, relier = null, achatRelie = null, ligne = null, ligneRes = null, onChoisirNum = null, extraTemps = null, outilsIdees = null }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  const racine = React.useRef(null), cadre = React.useRef(null);
  useGlisserPourFermer(racine, cadre, onFermer);
  const [vueFiche, setVueFiche] = useVueFiche();
  const slotCtx = React.useCallback((el) => poserSlot('contexte', el), []);
  const slotAct = React.useCallback((el) => poserSlot('actions', el), []);
  // UN SEUL bouton plein dans la fiche (AJOUT 3 de Julien) : celui de la carte d'action, sinon le premier geste principal rendu.
  React.useEffect(() => {
    const el = racine.current; if (!el || typeof MutationObserver === 'undefined') return undefined;
    const PRINC = '.fd-plein, .vrm-fp-b-plein, .vrm-b-primaire, [data-bouton-bord], .vrm-fu-imprimer-ligne, [data-variante="primaire"]';
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
  const lignesSites = Array.isArray(sites) ? sites : [];
  const [vue, setVue] = React.useState(null);
  const [plusOuvert, setPlusOuvert] = React.useState(false);
  const [tuile, setTuile] = React.useState(null);
  const numCle = p ? p.num : '';
  React.useEffect(() => { setVue(null); setPlusOuvert(false); setTuile(null); }, [numCle]);
  if (typeof document === 'undefined') return null;
  const I = (n, s = 18) => (Icon ? <Icon name={n} size={s}/> : null);
  const r = p && p.resume;
  const depuis = ligne && ligne.cle ? ligne : null;
  const ctx = depuis ? depuis.contexte : '';
  const saisir = p && onPrixAchat && p.idFiche && !p.ancienNumero && r && r.achat == null ? () => onPrixAchat(p) : null;
  const double = !!(p && p.double);
  const photo = (p && p.photo) || (depuis && depuis.photo) || '';
  // (15 nov., rouges-connus) Comme la photo : la paire lue sans titre prend celui de la LIGNE touchée (la même
  // annonce, désignée par identité) — la fiche d'un colis Vestiaire disait « Sans titre » sous « Cabas toile beige ».
  const titre = p ? ((neuve && neuve.titre) || p.titre || (p.etat === 'rien' ? 'N° jamais servi' : (depuis && depuis.titre) || 'Sans titre')) : ((depuis && depuis.titre) || tr('fiche.sansTitre'));
  const taille = p ? ((neuve && neuve.taille) || p.taille || '') : '';
  const ctxHeros = ctx ? tr(CLE_CTX[ctx] || 'fiche.ctx.vente') : '';
  const codeHeros = ctx === 'retrait' && depuis && depuis.sous ? depuis.sous : '';
  const action = p ? actionFiche(p, { sites: lignesSites, etat, proposition: relier ? relier.proposition : undefined,
    peutRelier: !!(relier && (relier.onRelier || relier.onAutre)), peutBordereau: !!onBordereau, peutBaisser: !!onPrix && !neuve, peutSaisir: !!saisir }) : null;
  const lEtat = p ? ligneEtat(p, { sites: lignesSites, etat, dateCourte: dateFd, action: action && action.sorte }) : null;
  const vueOuverte = vue || (p ? vueInitiale(p, lignesSites) : 'argent');
  const cases = p ? argentFiche(p, lignesSites) : [];
  const hist = p ? histoireFiche(p, { sites: lignesSites }) : [];
  // (16 nov., captures de Julien) Ouverte depuis une ligne de COLIS, la feuille porte déjà SON geste du bordereau
  // (« Imprimer le bordereau » / « Générer le bordereau », la place des actions de la ligne) : la tuile « Bordereau »
  // le redisait sous une autre forme. Une fonction, une forme (§7).
  const dispo = { neuve, note: !!((plus && plus.note) || note), atelier: !!(plus && plus.atelier), rappel: !!(plus && plus.rappel), onPrix, onPublierAilleurs, onDupliquer, outilsIdees, onBordereau: ctx === 'colis' ? null : onBordereau, onEmballer, histoNum };
  const tuiles = p ? tuilesFiche(p, dispo) : [];
  const fermerPlus = () => { setPlusOuvert(false); setTuile(null); };
  // Une tuile : un geste direct (il ferme la feuille), ou ce qu'elle montre (la note, l'atelier, le rappel, l'histoire du N°).
  const toucherTuile = (t) => {
    if (t === 'prix') { fermerPlus(); onPrix(p.num); return; }
    if (t === 'publier') { fermerPlus(); onPublierAilleurs(p.num); return; }
    if (t === 'dupliquer') { fermerPlus(); onDupliquer(p.num); return; }
    if (t === 'bordereau') { fermerPlus(); onBordereau(p.txAPoster); return; }
    if (t === 'emballer') { fermerPlus(); onEmballer(); return; }
    setTuile((x) => (x === t ? null : t));
    if (t === 'certificat') setTimeout(() => { try { const el = racine.current && racine.current.querySelector('[data-atelier-certificat]'); if (el) el.scrollIntoView({ block: 'center' }); } catch (_) {} }, 60);
  };
  const contenuTuile = !tuile ? null
    : tuile === 'note' ? ((plus && plus.note) || note)
    : (tuile === 'photos' || tuile === 'certificat') ? (plus && plus.atelier)
    : tuile === 'rappel' ? (plus && plus.rappel)
    : tuile === 'taille' ? outilsIdees
    : tuile === 'numero' && histoNum ? <HistoireNumero h={histoNum}/> : null;
  // « Tout voir » : tout ce que l'ancienne fiche montrait, replié ici UNE fois — rien n'est supprimé.
  const toutVoir = p ? (
    <details className="fd-tout" data-fiche-plus="">
      <summary className="fd-tout-s">{tr('verre2.fiche.toutVoir')}</summary>
      {/* (15 nov., lot argent-plus ; rangé dans la fiche D le 16 nov.) Ce que le site et les frais saisis retirent
          (src/beneficeArticle.js) — derrière « Tout voir » : la fiche D tient en un écran, chaque montant une fois (§7). */}
      {!double && r && r.detail && !cases.some((c) => c.cle === 'si-vendue') ? <BeneficeArticleDetail b={r.detail} seulement={r.detail.plateforme === 'eBay' ? ['vente', 'site', 'saisis'] : ['site', 'saisis']}/> : null}
      {depuis ? <section className="vrm-fp-contexte" data-fiche-contexte={ctx} aria-label={tr(CLE_CTX[ctx] || 'fiche.ctx.vente')} ref={slotCtx}/> : null}
      {etat && !double ? <EtatArticle etat={etat}/> : null}
      <OngletsFiche vue={vueFiche} onVue={setVueFiche}/>
      <HistoriqueModifications owner={owner} numero={p.num}/>
      {vueFiche === 'temps' ? <LigneDeTemps h={p} extra={extraTemps || {}}/> : <ol className="vrm-fp-parcours">
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
      </ol>}
      {plus && plus.infos ? plus.infos : null}
      {plus && plus.repub ? plus.repub : null}
      {!plus && note ? <div className="vrm-fp-note-privee" data-fiche-note="">{note}</div> : null}
      {neuve && onCopier ? <button type="button" className="fd-lien" data-fiche-copier="" onClick={() => onCopier(neuve)}>Copier le texte</button> : null}
      {p.manques.length ? <p className="vrm-fp-note" data-fiche-manques={p.manques.length}>Pas pu lire : {p.manques.join(', ')}.</p> : null}
    </details>
  ) : null;
  // LA FEUILLE « ⋯ » : toujours montée (les places de la LIGNE y vivent), cachée tant qu'elle est fermée.
  const feuillePlus = p ? (
    <div className="fd-plus" hidden={!plusOuvert} data-fd-plus={plusOuvert ? '1' : '0'} data-noglisse="1">
      <button type="button" className="fd-plus-voile" aria-label={tr('fd.plus.fermer')} tabIndex={-1} onClick={fermerPlus}/>
      <div className="fd-plus-f" role="dialog" aria-modal="true" aria-label={tr('fd.plus.titre')}>
        <div className="fd-plus-tete"><b>{tr('fd.plus.titre')}</b><Rond className="is-clair" aria-label={tr('fd.plus.fermer')} data-fd-plus-fermer="" onClick={fermerPlus}>{I('close', 18)}</Rond></div>
        {depuis ? <section className="vrm-fp-actions-sec" data-fiche-actions={ctx} aria-label={tr('fiche.actions')}><div className="vrm-fp-actions-ligne" ref={slotAct} data-fiche-actions-ligne=""/></section> : null}
        {tuiles.length ? <div className="fd-tuiles" role="group" aria-label={tr('fd.plus.titre')}>
          {tuiles.map((t) => <button key={t} type="button" className="fd-tuile" data-fd-tuile={t} aria-pressed={tuile === t ? 'true' : undefined}
            {...(t === 'prix' ? { 'data-fiche-prix': '' } : t === 'publier' ? { 'data-fiche-publier-ailleurs': '' } : t === 'dupliquer' ? { 'data-fiche-dupliquer': '' } : t === 'emballer' ? { 'data-fiche-emballer': '' } : t === 'bordereau' ? { 'data-fiche-bordereau-tuile': p.txAPoster } : {})}
            onClick={() => toucherTuile(t)}><span className="fd-tuile-ic" aria-hidden="true">{I(ICONE_TUILE[t], 20)}</span><span>{tr('fd.tuile.' + t)}</span></button>)}
        </div> : null}
        {contenuTuile ? <div className="fd-tuile-vue" data-fd-tuile-vue={tuile}>{contenuTuile}</div> : null}
        {plus && plus.gestes ? <div className="fd-gestes" data-fd-gestes="">{plus.gestes}</div> : null}
        {toutVoir}
      </div>
    </div>
  ) : null;
  const nomFiche = (p && p.num) || num || '';
  const ordi = planOrdinateur();
  const enPlan = !!depuis && (ctx === 'annonce' || ctx === 'stock') && ordi;
  const sansPaire = !p && depuis ? (
    <section className="vrm-fp-sans-paire fd-sans" data-fiche-sans-paire={ligneRes ? ligneRes.etat : 'aucun'} role="note">
      {ligneRes && ligneRes.etat === 'lot' ? <>
        <p className="vrm-fp-sans-paire-t">{tr('fiche.lotTitre', { n: String(ligneRes.nums.length) })}</p>
        <div className="vrm-fp-lot" data-fiche-lot={ligneRes.nums.join(',')}>
          {ligneRes.nums.map((n) => <button key={n} type="button" className="vrm-fp-b fd-touche" data-fiche-lot-num={n} onClick={() => onChoisirNum && onChoisirNum(n)}>N°{n}</button>)}
        </div>
      </> : ligneRes && ligneRes.etat === 'lecture' ? <p className="vrm-fp-sans-paire-t" data-fiche-lecture="">{tr('fiche.lecture')}</p>
        : ligneRes && ligneRes.etat === 'passu' ? <p className="vrm-fp-sans-paire-t">— {tr('fiche.passu')}</p>
        : <>
          <p className="vrm-fp-sans-paire-t">{tr('fiche.pasDePaire')}</p>
          <p className="vrm-fp-sans-paire-g" data-fiche-geste-relier="">{tr('fiche.gesteRelier.' + (ctx === 'achat' ? 'achat' : ctx === 'annonce' ? 'annonce' : 'vente'))}</p>
        </>}
      {/* La ligne sans paire : SES gestes restent sous les yeux (rien d'autre à montrer). */}
      <section className="vrm-fp-contexte" data-fiche-contexte={ctx} aria-label={tr(CLE_CTX[ctx] || 'fiche.ctx.vente')} ref={slotCtx}/>
      <section className="vrm-fp-actions-sec" data-fiche-actions={ctx} aria-label={tr('fiche.actions')}><div className="vrm-fp-actions-ligne" ref={slotAct} data-fiche-actions-ligne=""/></section>
    </section>
  ) : null;
  // Ordinateur : un voile derrière le panneau (hors de lui : il couvre la page, un clic ferme la fiche) — sauf en plan.
  return createPortal(<>
    {!enPlan && ordi ? <button type="button" className="fd-fond" data-fd-fond="" aria-label="Fermer la fiche" tabIndex={-1} onClick={onFermer}/> : null}
    <div ref={racine} className={'vrm-fp fd' + (depuis ? ' is-depuis-ligne' : '') + (enPlan ? ' sb-plan fd-plan' : '') + (ordi ? ' fd-ordi' : '')} role="dialog" aria-modal={enPlan ? 'false' : 'true'} data-sb-plan={enPlan ? '1' : undefined} aria-label={nomFiche ? `Tout sur le N°${nomFiche}` : tr('fiche.heros')} data-fiche-paire={nomFiche} data-fiche-contexte-ouvert={ctx || undefined}
      data-fiche-ligne-cle={depuis ? depuis.cle : undefined} data-fiche-identite={depuis ? (ligneRes ? ligneRes.etat + ':' + (ligneRes.par || '') : '') : 'numero'} data-fiche-lecture-en-cours={lecture ? '1' : '0'} data-fd-vue={p ? vueOuverte : undefined} data-noswipe="1">
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="fd-cadre" ref={cadre}>
        <div className={'fd-ph' + (photo ? '' : ' is-sans-photo')} data-fiche-heros={ctx || 'numero'} data-fiche-photo-vedette={photo ? '1' : '0'}>
          <span className="fd-ph-img" data-fiche-heros-photo={photo ? '1' : '0'}>{photo && Photo ? Photo(photo) : <Silhouette/>}</span>
          <i className="fd-scrim" aria-hidden="true"/>
          <div className="fd-top">
            <Rond data-fiche-retour="" data-fiche-fermer={depuis || !onRetour ? "" : undefined} aria-label={depuis ? tr('fiche.retour') : tr('fd.retour')} onClick={onRetour || onFermer}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></Rond>
            {p ? <Rond data-fd-plus-ouvrir="" aria-label={tr('fd.plus.titre')} aria-expanded={plusOuvert} onClick={() => setPlusOuvert(true)}>{I('more', 20)}</Rond>
              : <Rond aria-label="Fermer la fiche" data-fiche-fermer="" onClick={onFermer}>{I('close', 20)}</Rond>}
          </div>
          {p ? <span className={'fd-plaque num' + (double ? ' is-double' : '')} data-fiche-grand-num="">N°{p.num}</span>
            : depuis ? <span className="fd-plaque num is-sans" data-fiche-grand-num="" data-fiche-sans-num="">{ligneRes && ligneRes.etat === 'lot' ? tr('fiche.lotN', { n: String(ligneRes.nums.length) }) : tr('fiche.sansNum')}</span> : null}
        </div>
        <div className="fd-s">
          {!p && !depuis ? <p className="vrm-fp-vide" data-fiche-vide="">{lecture ? `Je lis l’histoire de ${motsVendeur().ce}…` : `Le N°${num} n’est pas un numéro.`}</p> : null}
          {(p || depuis) ? <div className="fd-t" aria-label={tr('fiche.heros')}>
            {ctxHeros ? <span className="fd-ctx" data-fiche-heros-ctx="">{codeHeros ? <>{`${ctxHeros} · `}<span className="vrm-sensible" data-stream-type="code" data-fiche-heros-code="">{codeHeros}</span></> : [ctxHeros, depuis && depuis.sous].filter(Boolean).join(' · ')}</span> : null}
            <h1 className="fd-nom">{motsInsecables(titre)}{taille ? ` · ${taille}` : ''}</h1>
            {lEtat ? <span className={'fd-etat' + (lEtat.ambre ? ' is-am' : '') + (lEtat.rouge ? ' is-rouge' : '')} data-fd-etat={lEtat.cle} data-fd-ambre={lEtat.ambre ? '1' : '0'}>{tr(lEtat.cle, { ...lEtat.vars, prix: lEtat.vars.prix != null ? eur(lEtat.vars.prix) : '' })}</span>
              : depuis && depuis.prix ? <span className="fd-etat" data-fiche-heros-prix={depuis.prix}>{depuis.prix}</span> : null}
            {neuve ? <span className="fd-etat" data-fiche-neuve="">Photos à prendre</span> : null}
            {p && p.ancienNumero ? <span className="fd-etat">Ancien numéro (d’avant la remise à zéro)</span> : null}
          </div> : null}
          {double ? <p className="vrm-fp-double fd-double" role="alert" data-fiche-double="1" data-fiche-choisit="0">Deux {motsVendeur().noms} présent{motsVendeur().e}s portent le N°{p.num} : vérifie là où {motsVendeur().elle}s sont rangé{motsVendeur().e}s avant d’emballer ou d’imprimer.</p> : null}
          <CarteAction a={action} I={I} Photo={Photo} relier={relier} onBordereau={onBordereau} onPrix={onPrix} onSaisir={saisir} num={p && p.num}/>
          {sansPaire}
          {p ? <>
            <div className="fd-seg" role="tablist" aria-label={tr('fd.seg.titre')}>
              {['argent', 'sites', 'histoire'].map((v) => <button key={v} type="button" role="tab" className="fd-seg-b" aria-selected={vueOuverte === v} data-fd-seg={v} onClick={() => setVue(v)}>{tr('fd.seg.' + v)}</button>)}
            </div>
            <div className="fd-v" role="tabpanel" data-fd-vue-ouverte={vueOuverte}>
              {vueOuverte === 'argent' ? (double ? <p className="fd-vide">{tr('fd.argent.double')}</p> : <VueArgent cases={cases} etat={etat} lien={achatRelie}/>)
                : vueOuverte === 'sites' ? <VueSites sites={lignesSites} I={I}/>
                : <VueHistoire lignes={hist}/>}
            </div>
            {/* Ce que VRM demande de trancher sur cette paire (« Tu l'as encore ? », vendue ailleurs, à retirer ailleurs,
                même photo) : rendu seulement quand il y a une question — sinon rien (chacun rend null). */}
            {plus && plus.questions ? <div className="fd-questions" data-fd-questions="">{plus.questions}</div> : null}
            {lecture ? <p className="fd-vide" data-fiche-lecture="">Lecture en cours…</p> : null}
          </> : null}
        </div>
        {feuillePlus}
      </div>
    </div></>, document.body);
}
