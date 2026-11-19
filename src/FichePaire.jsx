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
import { articleFiche, HISTOIRE_REPLIEE } from './ficheProduit.js';
import { Etiquette } from './designV2/Signature.jsx';   // (19 nov.) le N° : l'étiquette carton du nouveau design, la même que dans les listes
import { useDesignV2 } from './designV2/reglage.js';

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


// ══ (19 nov. 2026, « FICHE DIRECTE » — docs/passation/2026-11-19-fiche-directe.md) ═══════════════════════════════════
// Julien : « je dois cliquer sur la paire puis cliquer sur les points pour avoir des informations. Ce n'est pas normal,
// ça doit être beaucoup plus accessible et beaucoup plus simple », puis « l'outil doit être pratique, pas chiant ».
// Le 15 nov. il avait rejeté une fiche de six écrans : on n'empile donc pas, on montre l'ESSENTIEL d'un coup.
//   1. en-tête compact (photo touchable, plaque N°, titre sur 2 lignes, UNE ligne d'état) ;
//   2. la grille de FAITS, toujours visible (`faitsFiche`) : un fait qui se corrige EST la porte, sur place ;
//   3. les sites et les comptes, une rangée par site ;
//   4. UN bouton principal selon l'état ; 5. les gestes en tuiles (plus de feuille « ⋯ » obligatoire) ;
//   6. l'histoire, repliée à ses 3 dernières étapes, puis « Tout voir ».
// Plus d'onglets Argent · Sites · Histoire. « ⋯ » (téléphone) ne garde que les gestes rares de la LIGNE et « Vendu
// ailleurs » ; à l'ordinateur ils sont posés en bas du volet (rien derrière un menu). La règle de rangement est
// src/ficheProduit.js (pure) ; ici, seulement le rendu. Tous les `data-*` d'avant qui ont encore un sens sont gardés.
const NOM_SITE_FD = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const dateFd = (t) => { const d = new Date(t); if (!Number.isFinite(d.getTime())) return ''; return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
// Un rond de la barre (‹, ⋯, ×) : 44 px.
const Rond = ({ children, className = '', ...p }) => <button type="button" className={'fd-rond ' + className} {...p}>{children}</button>;
const ICONE_TUILE = { note: 'pencil', photos: 'camera', certificat: 'doc', rappel: 'clock', prix: 'tag', publier: 'shop', republier: 'sync', dupliquer: 'copy', taille: 'grid', bordereau: 'printer', emballer: 'box', numero: 'journal' };
const MarqueSite = (site, I) => (['vinted', 'ebay', 'leboncoin', 'vestiaire'].includes(site) ? <MarquePlateforme site={site} taille={site === 'ebay' ? 10 : 16}/> : I('tag', 16));
const eurosSaisis = (c) => (c == null ? '' : String(c / 100).replace('.', ','));

// UN FAIT QUI SE TAPE SUR PLACE (prix d'achat, prix mini) : toucher la valeur ouvre le champ À SA PLACE ; Entrée (ou
// quitter le champ) enregistre, Échap annule. Vide ou inchangé ⇒ rien n'est écrit. 16 px au moins (iOS ne zoome pas).
function ChampFait({ depart, label, onValider, onFin }) {
  const [v, setV] = React.useState(depart);
  const fini = React.useRef(false);
  const finir = (ecrire) => { if (fini.current) return; fini.current = true; const t = String(v).trim(); if (ecrire && t && t !== String(depart).trim()) onValider(t); onFin(); };
  return <input className="fd-fait-champ num" data-fd-fait-champ="" autoFocus inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label={label} value={v} placeholder="€"
    onChange={(e) => setV(e.target.value)} onFocus={(e) => { try { e.target.select(); } catch (_) {} }}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finir(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finir(false); } }} onBlur={() => finir(true)}/>;
}

// LA GRILLE DE FAITS. Les `data-*` d'avant restent sur leur case (résumé achat / bénéfice / si vendue, état « prix-achat »).
function GrilleFaits({ faits, etat, edition, setEdition, portes, I }) {
  if (!faits.length) return null;
  const argent = faits.filter((f) => f.cle === 'achat' || f.cle === 'benefice' || f.cle === 'si-vendue').map((f) => f.cle);
  return (
    <section className="fd-faits" data-fd-faits={faits.map((f) => f.cle).join(',')} data-fd-vue-argent={argent.join(',')} aria-label={tr('fd.f.titre')}>
      {faits.map((f) => {
        const attrs = f.cle === 'achat' ? { 'data-fiche-resume-achat': f.cents == null ? '' : f.cents, ...(etat ? { 'data-etat-ligne': 'prix-achat', 'data-etat-val': etat.prixAchat.cents == null ? '' : etat.prixAchat.cents, 'data-etat-source': etat.prixAchat.source || '' } : {}) }
          : f.cle === 'benefice' ? { 'data-fiche-resume-benefice': f.cents == null ? '' : f.cents, 'data-fiche-benefice-partiel': f.partiel ? '1' : undefined }
          : f.cle === 'si-vendue' ? { 'data-fiche-resume-benefice': '', 'data-fiche-si-vendue': f.cents == null ? '' : f.cents, 'data-fiche-benefice-partiel': f.partiel ? '1' : undefined }
          : f.cle === 'prix' ? { 'data-fiche-resume-vente': f.cents == null ? '' : f.cents } : {};
        const su = f.cle === 'interet' ? true : f.cle === 'taille' || f.cle === 'place' ? !!f.texte : f.cle === 'quand' ? (f.date != null || f.jours != null) : f.cents != null;
        const valeur = f.cle === 'interet' ? [f.favoris, f.vues].filter((x) => x != null).join(' · ')
          : f.cle === 'taille' || f.cle === 'place' ? (f.texte || '—')
          : f.cle === 'quand' ? (f.date != null ? dateFd(f.date) : f.jours != null ? tr('fd.f.jours', { n: f.jours }) : '—')
          : f.cents == null ? '—' : f.signe ? signe(f.cents) : eur(f.cents);
        const sous = !su && f.raison ? tr(f.raison) : f.partiel ? tr('fd.argent.auPlus') : f.auMoins ? tr('fd.f.auMoins') : '';
        const porte = f.porte && portes[f.porte] ? f.porte : null;
        const sr = f.brut ? <small className="vg-sr" data-fiche-raison-benef="">{f.brut}</small> : null;
        const cls = 'fd-fait is-' + f.cle + (f.large ? ' is-large' : '') + (su ? '' : ' is-manque') + (porte ? ' is-porte' : '');
        const communs = { 'data-fd-fait': f.cle, 'data-fd-fait-su': su ? '1' : '0', 'data-fd-fait-porte': porte || undefined, ...attrs };
        if (porte && edition === f.cle) return (
          <div key={f.cle} className={cls + ' is-edition'} {...communs}>
            <span className="fd-fait-l">{tr(f.lib)}</span>
            <ChampFait depart={eurosSaisis(f.cents)} label={tr(f.lib)} onValider={(t) => portes[porte](f, t)} onFin={() => setEdition(null)}/>
          </div>
        );
        if (porte) {
          const surPlace = porte === 'achat' || porte === 'mini';
          return (
            <button key={f.cle} type="button" className={cls} {...communs} {...(f.cle === 'achat' && !su ? { 'data-fiche-saisir-achat': '' } : {})} {...(f.cle === 'prix' ? { 'data-fiche-prix': '' } : {})}
              aria-label={`${tr(f.lib)} : ${valeur}${sous ? ', ' + sous : ''} — ${tr('fd.f.porte.' + porte)}`}
              onClick={() => { if (surPlace) setEdition(f.cle); else portes[porte](f); }}>
              <span className="fd-fait-l">{tr(f.lib)}</span>
              <b className="num fd-fait-v">{valeur}<i className="fd-fait-crayon" aria-hidden="true">{I(porte === 'place' || porte === 'lien' ? 'chevron' : 'pencil', 13)}</i></b>
              {sous ? <small className="fd-fait-s">{sous}</small> : null}{sr}
            </button>
          );
        }
        return (
          <div key={f.cle} className={cls} {...communs}>
            <span className="fd-fait-l">{tr(f.lib)}</span>
            <b className="num fd-fait-v">{valeur}</b>
            {sous ? <small className="fd-fait-s">{sous}</small> : null}{sr}
          </div>
        );
      })}
    </section>
  );
}

// LES SITES ET LES COMPTES : une rangée par site (logo, compte, état, prix s'il diffère du prix de la grille). La rangée
// d'une annonce en ligne dont l'adresse est lue ouvre l'annonce sur son site. Ce qui n'est pas lu est DIT.
function Sites({ sites, manques, prixRef, I }) {
  const pasLus = Array.isArray(manques) ? manques : [];
  if (!sites.length && !pasLus.length) return <p className="fd-vide" data-fd-sites="0" data-fiche-sites="0">{tr('fd.sites.aucun')}</p>;
  return (
    <section className="fd-sites" data-fd-sites={sites.length} data-fiche-sites={sites.length} aria-label={tr('fd.sites.titre')}>
      {sites.map((s, i) => {
        const etat = s.etat === 'vendue' ? (s.date ? tr('fd.sites.vendueLe', { date: dateFd(s.date) }) : tr('fd.sites.vendue')) : tr('fd.sites.enLigne');
        const prix = s.prix != null && s.prix !== prixRef ? eur(s.prix) : '';
        const corps = (<>
          <span className="fd-site-logo" aria-hidden="true">{MarqueSite(s.site, I)}</span>
          <span className="fd-site-txt"><b>{NOM_SITE_FD[s.site] || s.site}</b>{s.compte ? <span className="fd-site-compte">{s.compte}</span> : null}</span>
          <span className="fd-site-fin">{prix ? <b className="num" data-fiche-site-prix={s.prix}>{prix}</b> : null}<span>{etat}</span></span>
        </>);
        const attrs = { className: 'fd-site', 'data-fiche-site': s.site, 'data-fiche-site-etat': s.etat };
        return s.lien && s.etat !== 'vendue'
          ? <a key={i} {...attrs} href={s.lien} target="_blank" rel="noreferrer" data-fiche-site-lien="" aria-label={tr('fd.sites.voirSur', { site: NOM_SITE_FD[s.site] || s.site })}>{corps}<i className="fd-site-va" aria-hidden="true">{I('chevron', 14)}</i></a>
          : <div key={i} {...attrs}>{corps}</div>;
      })}
      {pasLus.length ? <p className="fd-sites-manque" data-fd-sites-pas-lus={pasLus.join(',')}>{tr('fd.sites.pasLus', { sites: pasLus.join(', ') })}</p> : null}
    </section>
  );
}

// LE BOUTON PRINCIPAL (un seul plein) et la ligne courte qui le situe — jamais une phrase d'explication.
function BlocAction({ a, I, Photo, relier, onBordereau, onPrix, onSaisir, num }) {
  if (!a) return null;
  if (a.sorte === 'relier') {
    const pr = a.proposition;
    const lit = pr === undefined;
    const achat = pr && pr.achat;
    const d = pr && Number.isFinite(pr.recuMs) ? dateFd(pr.recuMs) : achat && achat.date ? dateFd(Date.parse(achat.date)) : '';
    const autre = () => relier && relier.onAutre && relier.onAutre();
    return (
      <section className="fd-agir is-am" data-fd-action="relier" data-fd-propose={pr ? String(pr.tx || '') : lit ? 'lecture' : ''} aria-label={tr('fd.relier.titre')}>
        {pr ? (<>
          <div className="fd-act-p" data-fd-achat-propose={String(pr.tx || '')} data-fd-achat-niveau={pr.niveau || ''}>
            <span className="fd-act-ph">{achat && achat.photo && Photo ? Photo(achat.photo) : <Silhouette/>}</span>
            <span className="fd-act-pt"><b>{motsInsecables(pr.titre || (achat && achat.title) || '')}</b>
              <span>{[d ? tr(pr.recuMs != null ? (pr.recuSource === 'livraison' ? 'fd.relier.livreeLe' : 'fd.relier.retireeLe') : 'fd.relier.commandeeLe', { date: d }) : '', pr.texte ? tr('fd.relier.payee', { prix: pr.texte }) : ''].filter(Boolean).join(' · ')}</span></span>
          </div>
          <button type="button" className="fd-plein sb-btn-plein" data-fd-plein="" data-fd-relier={String(pr.tx || '')} data-fd-relier-cents={pr.centimes == null ? '' : String(pr.centimes)} onClick={() => relier && relier.onRelier && relier.onRelier(pr)}>{I('link', 19)}<span>{pr.texte ? tr('fd.relier.plein', { prix: pr.texte }) : tr('fd.relier.pleinSansPrix')}</span></button>
          <button type="button" className="fd-lien" data-fd-relier-autre="" onClick={autre}>{tr('fd.relier.autre')}</button>
        </>) : lit ? (<>
          <span className="fd-act-l" data-fd-relier-etat="lecture">{tr('fd.relier.cherche')}</span>
          <button type="button" className="fd-lien" data-fd-relier-autre="" onClick={autre}>{tr('fd.relier.autre')}</button>
        </>) : <button type="button" className="fd-plein sb-btn-plein" data-fd-plein="" data-fd-relier-autre="" data-fd-relier-etat="aucun" onClick={autre}>{I('link', 19)}<span>{tr('fd.relier.choisir')}</span></button>}
      </section>
    );
  }
  if (a.sorte === 'bordereau') return (
    <section className="fd-agir" data-fd-action="bordereau" aria-label={tr('fd.bord.titre')}>
      {a.pret || a.limite ? <span className="fd-act-l">
        {a.pret ? <span>{tr('fd.bord.pret')}</span> : null}
        {/* (16 nov., lot ecrans-restes) La date limite d'envoi, par la règle de Colis (l'e-mail du bordereau, sinon estimée). */}
        {a.limite ? <span className={a.limite.ambre ? 'is-am' : ''} data-fd-limite={a.limite.jour || ''} data-fd-limite-estimee={a.limite.estimee ? '1' : '0'}>{a.limite.texte}</span> : null}
      </span> : null}
      <button type="button" className="fd-plein sb-btn-plein" data-fd-plein="" data-fiche-bordereau={a.tx || ''} onClick={() => onBordereau && onBordereau(a.tx)}>{I('printer', 19)}<span>{tr('fd.bord.plein')}</span></button>
    </section>
  );
  if (a.sorte === 'baisser') {
    const t = a.jours != null && a.offres === 0 ? tr('fd.baisser.aucuneOffre', { n: a.jours }) : a.jours != null && a.offres ? tr('fd.baisser.offres', { n: a.offres, j: a.jours }) : '';
    return (
      <section className="fd-agir" data-fd-action="baisser" aria-label={tr('fd.baisser.plein')}>
        {t ? <span className="fd-act-l">{t}</span> : null}
        <button type="button" className="fd-plein sb-btn-plein" data-fd-plein="" data-fiche-prix="" data-fd-baisser={num} onClick={() => onPrix && onPrix(num)}>{I('tag', 19)}<span>{tr('fd.baisser.plein')}</span></button>
      </section>
    );
  }
  if (a.sorte === 'saisir') return (
    <section className="fd-agir is-am" data-fd-action="saisir" aria-label={tr('fd.saisir.titre')}>
      <button type="button" className="fd-plein sb-btn-plein" data-fd-plein="" data-fiche-saisir-achat="" onClick={onSaisir}>{I('pencil', 19)}<span>{tr('fd.saisir.plein')}</span></button>
    </section>
  );
  return null;
}

// (16 nov., relier-fiable — Julien : « j'ai mal relié un achat, je veux pouvoir l'enlever, et tu peux mettre le justificatif
// d'achat à côté ») L'achat RELIÉ (par son n° de transaction) : « Reçu » (le reçu de CET achat) ou « Pas de reçu » (jamais un
// lien mort), et « Délier » (confirmé, annulable). (19 nov.) Ils vivent sur la ligne « Achetée » de l'histoire.
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

// L'HISTOIRE (achat → stock → annonce(s) → vente → colis → argent) : repliée, ses 3 dernières étapes.
function Histoire({ lignes, tout, lien }) {
  if (!lignes.length) return <p className="fd-vide">{tr('fd.h.vide')}</p>;
  const vues = tout ? lignes : lignes.slice(-HISTOIRE_REPLIEE);
  return (
    <ol className="fd-hist" data-fiche-hist={lignes.length} data-fiche-hist-vues={vues.length}>
      {vues.map((l) => {
        const d = l.at != null ? dateFd(l.at) : '';
        const reste = [l.vendeur ? tr('fd.h.vendeur', { nom: l.vendeur }) : '', d, l.montant != null ? eur(l.montant) : '', l.compte || '', l.sites && l.sites.length ? l.sites.map((x) => NOM_SITE_FD[x] || x).join(', ') : '', l.detail ? tr(l.detail, { n: l.n }) : ''].filter(Boolean).join(' · ');
        return <li key={l.cle} className={'fd-hist-l' + (l.ton ? ' is-' + l.ton : '')} data-fiche-hist-etape={l.cle}><i aria-hidden="true"/><span className="fd-hist-t"><b>{l.libre || tr(l.titre)}</b>{reste ? <span>{reste}</span> : null}{l.cle === 'achat' ? <GestesAchatRelie lien={lien}/> : null}</span></li>;
      })}
    </ol>
  );
}

// LA PHOTO EN GRAND (toucher la photo de l'en-tête) : les photos de la paire, une par page, qui glissent (défilement natif).
function Visionneuse({ photos, Photo, onFermer, I, titre }) {
  const [i, setI] = React.useState(0);
  const piste = React.useRef(null);
  return (
    <div className="fd-vis" role="dialog" aria-modal="true" aria-label={titre} data-fd-visionneuse={photos.length} data-noglisse="1">
      <div className="fd-vis-piste" ref={piste} onScroll={(e) => { const w = e.currentTarget.clientWidth || 1; setI(Math.round(e.currentTarget.scrollLeft / w)); }}>
        {photos.map((src) => <span key={src} className="fd-vis-page">{Photo(src)}</span>)}
      </div>
      <Rond className="fd-vis-fermer" aria-label={tr('fd.photo.fermer')} data-fd-visionneuse-fermer="" autoFocus onClick={onFermer}>{I('close', 20)}</Rond>
      {photos.length > 1 ? <span className="fd-vis-n num" aria-live="polite">{`${i + 1} / ${photos.length}`}</span> : null}
    </div>
  );
}

export default function FichePaire({ owner = '', p, etat = null, histoNum = null, lecture = false, num, onFermer, onRetour, onBordereau, onEmballer, onPrix, onPrixAchat = null, onDupliquer, onPublierAilleurs, onRepublier = null, onSource, neuve = null, onCopier, Photo, Icon, Retour, note = null, plus = null, sites = null, sitesManques = undefined, taille: tailleLue = '', photos = null, edits = null, achatParNum = null, siVendue = null, relier = null, achatRelie = null, ligne = null, ligneRes = null, onChoisirNum = null, extraTemps = null, outilsIdees = null }) {
  const racine = React.useRef(null), cadre = React.useRef(null);
  useGlisserPourFermer(racine, cadre, onFermer);
  const [vueFiche, setVueFiche] = useVueFiche();
  const designV2 = useDesignV2();
  const slotCtx = React.useCallback((el) => poserSlot('contexte', el), []);
  const slotAct = React.useCallback((el) => poserSlot('actions', el), []);
  const lignesSites = Array.isArray(sites) ? sites : [];
  const [plusOuvert, setPlusOuvert] = React.useState(false);
  const [tuile, setTuile] = React.useState(null);
  const [edition, setEdition] = React.useState(null);     // le fait en cours de saisie sur place ('achat' | 'mini')
  const [toutHist, setToutHist] = React.useState(false);  // « Tout voir » de l'histoire
  const [grand, setGrand] = React.useState(false);        // la photo en grand
  const numCle = p ? p.num : '';
  React.useEffect(() => { setPlusOuvert(false); setTuile(null); setEdition(null); setToutHist(false); setGrand(false); }, [numCle]);
  // Échap : ferme d'abord ce qui est posé par-dessus (la photo en grand, « ⋯ »), puis la fiche.
  const dessus = React.useRef({}); dessus.current = { grand, plusOuvert };
  React.useEffect(() => {
    const k = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      if (dessus.current.grand) setGrand(false); else if (dessus.current.plusOuvert) setPlusOuvert(false); else onFermer();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  // UN SEUL bouton plein dans la fiche (AJOUT 3 de Julien) : celui du bouton principal, sinon le premier geste principal rendu.
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
  // (17 nov., accessibilité WCAG 2.4.3) Feuille modale : le focus ENTRE à l'ouverture, Tab et Maj+Tab
  // tournent DEDANS (une feuille posée par-dessus, ex. « Plus », garde son propre tour), et le focus
  // REVIENT à ce qui l'avait ouverte. En plan (ordinateur, à côté de la liste, aria-modal="false") : rien.
  React.useEffect(() => {
    const el = racine.current; if (!el) return undefined;
    const modale = () => el.getAttribute('aria-modal') === 'true';
    const avant = document.activeElement;
    const SEL = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
    const focusables = () => [...el.querySelectorAll(SEL)].filter((x) => x.tabIndex >= 0 && x.getClientRects().length && !x.closest('[inert],[aria-hidden="true"]') && x.closest('[role="dialog"]') === el);
    if (modale() && !el.contains(document.activeElement)) { el.setAttribute('tabindex', '-1'); try { el.focus({ preventScroll: true }); } catch (_) {} }
    const k = (e) => {
      if (e.key !== 'Tab' || !modale()) return;
      const dessus = e.target && e.target.closest ? e.target.closest('[role="dialog"]') : null;
      if (dessus && dessus !== el && el.contains(dessus)) return;
      const f = focusables(); if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey) { if (i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } }
      else if (i === -1 || i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', k, true);
    return () => {
      document.removeEventListener('keydown', k, true);
      try { if (modale() && avant && avant !== document.body && document.contains(avant) && typeof avant.focus === 'function') avant.focus({ preventScroll: true }); } catch (_) {}
    };
  }, []);
  if (typeof document === 'undefined') return null;
  const I = (n, s = 18) => (Icon ? <Icon name={n} size={s}/> : null);
  const depuis = ligne && ligne.cle ? ligne : null;
  const ctx = depuis ? depuis.contexte : '';
  const double = !!(p && p.double);
  const taille = p ? (String(tailleLue || '') || (neuve && neuve.taille) || p.taille || '') : '';
  const ctxHeros = ctx ? tr(CLE_CTX[ctx] || 'fiche.ctx.vente') : '';
  const codeHeros = ctx === 'retrait' && depuis && depuis.sous ? depuis.sous : '';
  // Le prix d'achat : tapé SUR PLACE (`edits.achat` — la fiche de l'annonce, sinon le N°), sinon la feuille d'avant.
  const achatSurPlace = !!(p && edits && edits.achat && !p.ancienNumero && !double && !achatRelie);
  const achatConnu = !!(p && ((p.resume && p.resume.achat != null) || Number.isFinite(achatParNum)));
  const saisirFeuille = p && onPrixAchat && p.idFiche && !p.ancienNumero && !achatConnu ? () => onPrixAchat(p) : null;
  const saisir = achatSurPlace && !achatConnu ? () => { setEdition('achat'); try { const c = racine.current && racine.current.querySelector('[data-fd-fait="achat"]'); if (c) c.scrollIntoView({ block: 'center' }); } catch (_) {} } : saisirFeuille;
  const allerAchat = () => { setToutHist(true); setTimeout(() => { try { const e = racine.current && racine.current.querySelector('[data-fiche-hist-etape="achat"]'); if (e) e.scrollIntoView({ block: 'center' }); } catch (_) {} }, 60); };
  const portes = p ? {
    achat: achatSurPlace ? (f, t) => edits.achat(t) : null,
    relier: relier && relier.onAutre ? () => relier.onAutre() : (saisirFeuille || null),
    lien: achatRelie ? allerAchat : null,
    prix: onPrix && !neuve ? () => onPrix(p.num, true) : null,
    mini: edits && edits.mini ? (f, t) => edits.mini(f.id, t) : null,
    place: onSource ? () => onSource({ stock: p.num }) : null,
  } : {};
  // L'ARTICLE (src/ficheProduit.js, `articleFiche`) : tout ce que la fiche montre, rangé une fois — la vue ne calcule rien.
  // (16 nov., captures de Julien) Ouverte depuis une ligne de COLIS, la fiche porte déjà SON geste du bordereau (la place des
  // actions de la ligne) : la tuile « Bordereau » le redisait sous une autre forme. Une fonction, une forme (§7).
  const A = p ? articleFiche(p, { sites: lignesSites, sitesManques, etat, taille, photos, neuve, achatParNum, siVendue, relie: !!achatRelie, dateCourte: dateFd,
    peut: { achat: !!portes.achat, relier: !!portes.relier, prix: !!portes.prix, mini: !!portes.mini, place: !!portes.place },
    action: { proposition: relier ? relier.proposition : undefined, peutRelier: !!(relier && (relier.onRelier || relier.onAutre)), peutBordereau: !!onBordereau, peutBaisser: !!onPrix && !neuve, peutSaisir: !!saisir },
    dispo: { neuve, note: !!((plus && plus.note) || note), atelier: !!(plus && plus.atelier), rappel: !!(plus && plus.rappel), onPrix, onPublierAilleurs, onRepublier, onDupliquer, outilsIdees, onBordereau: ctx === 'colis' ? null : onBordereau, onEmballer, histoNum } }) : null;
  const r = A ? A.p.resume : null;
  const photo = (A && A.photo) || (depuis && depuis.photo) || '';
  const toutesPhotos = [...new Set([photo, ...(A ? A.photos : [])].filter(Boolean))];
  // (15 nov., rouges-connus) Comme la photo : la paire lue sans titre prend celui de la LIGNE touchée (la même
  // annonce, désignée par identité) — la fiche d'un colis Vestiaire disait « Sans titre » sous « Cabas toile beige ».
  const titre = A ? (A.titre || (A.p.etat === 'rien' ? 'N° jamais servi' : (depuis && depuis.titre) || 'Sans titre')) : ((depuis && depuis.titre) || tr('fiche.sansTitre'));
  const action = A ? A.action : null, lEtat = A ? A.etat : null, faits = A ? A.faits : [], prixRef = A ? A.prixRef : undefined, hist = A ? A.histoire : [], tuiles = A ? A.gestes : [];
  const fermerPlus = () => { setPlusOuvert(false); };
  // Une tuile : un geste direct, ou ce qu'elle montre SOUS la grille (la note, l'atelier, le rappel, l'histoire du N°).
  const toucherTuile = (t) => {
    if (t === 'prix') { onPrix(p.num); return; }
    if (t === 'publier') { onPublierAilleurs(p.num); return; }
    if (t === 'republier') { onRepublier(p.num); return; }
    if (t === 'dupliquer') { onDupliquer(p.num); return; }
    if (t === 'bordereau') { onBordereau(p.txAPoster); return; }
    if (t === 'emballer') { onEmballer(); return; }
    setTuile((x) => (x === t ? null : t));
    setTimeout(() => { try { const el = racine.current && racine.current.querySelector(t === 'certificat' ? '[data-atelier-certificat]' : '[data-fd-tuile-vue]'); if (el) el.scrollIntoView({ block: 'center' }); } catch (_) {} }, 60);
  };
  const contenuTuile = !tuile ? null
    : tuile === 'note' ? ((plus && plus.note) || note)
    : (tuile === 'photos' || tuile === 'certificat') ? (plus && plus.atelier)
    : tuile === 'rappel' ? (plus && plus.rappel)
    : tuile === 'taille' ? outilsIdees
    : tuile === 'numero' && histoNum ? <HistoireNumero h={histoNum}/> : null;
  // « Tout voir » : le détail de l'histoire, ouvert SUR la fiche — rien n'est supprimé, rien n'est derrière « ⋯ ».
  const toutVoir = p ? (
    <details className="fd-tout" data-fiche-plus="" open={toutHist} onToggle={(e) => { const o = e.currentTarget.open; if (o !== toutHist) setToutHist(o); }}>
      <summary className="fd-lien fd-tout-s" data-fd-tout-voir="">{tr(toutHist ? 'fd.h.replier' : 'verre2.fiche.toutVoir')}</summary>
      {/* (15 nov., lot argent-plus) Ce que le site et les frais saisis retirent (src/beneficeArticle.js). */}
      {!double && r && r.detail && !faits.some((c) => c.cle === 'si-vendue') ? <BeneficeArticleDetail b={r.detail} seulement={r.detail.plateforme === 'eBay' ? ['vente', 'site', 'saisis'] : ['site', 'saisis']}/> : null}
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
  const nomFiche = (p && p.num) || num || '';
  const ordi = planOrdinateur();
  const enPlan = !!depuis && (ctx === 'annonce' || ctx === 'stock') && ordi;
  // LES GESTES RARES : ceux de la LIGNE (`poserSlot('actions')`, src/DansFiche.jsx) et « Vendu ailleurs ». Téléphone : la
  // feuille « ⋯ » (toujours montée — les places de la ligne y vivent —, cachée tant qu'elle est fermée) ; ordinateur :
  // posés en bas du volet, sans menu. AUCUNE information n'y vit.
  const rares = p ? (<>
    {depuis ? <section className="vrm-fp-actions-sec" data-fiche-actions={ctx} aria-label={tr('fiche.actions')}><div className="vrm-fp-actions-ligne" ref={slotAct} data-fiche-actions-ligne=""/></section> : null}
    {plus && plus.gestes ? <div className="fd-gestes" data-fd-gestes="">{plus.gestes}</div> : null}
  </>) : null;
  const feuillePlus = p && !ordi ? (
    <div className="fd-plus" hidden={!plusOuvert} data-fd-plus={plusOuvert ? '1' : '0'} data-noglisse="1">
      <button type="button" className="fd-plus-voile" aria-label={tr('fd.plus.fermer')} tabIndex={-1} onClick={fermerPlus}/>
      <div className="fd-plus-f" role="dialog" aria-modal="true" aria-label={tr('fd.plus.titre')}>
        <div className="fd-plus-tete"><b>{tr('fd.plus.titre')}</b><Rond aria-label={tr('fd.plus.fermer')} data-fd-plus-fermer="" onClick={fermerPlus}>{I('close', 18)}</Rond></div>
        {rares}
      </div>
    </div>
  ) : null;
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
  const plaque = p ? <span className={'fd-plaque num' + (double ? ' is-double' : '') + (designV2 ? ' is-etiquette' : '')} data-fiche-grand-num="">{designV2 ? <Etiquette num={p.num} double={double} taille="moyen"/> : `N°${p.num}`}</span>
    : depuis ? <span className="fd-plaque num is-sans" data-fiche-grand-num="" data-fiche-sans-num="">{ligneRes && ligneRes.etat === 'lot' ? tr('fiche.lotN', { n: String(ligneRes.nums.length) }) : tr('fiche.sansNum')}</span> : null;
  // Ordinateur : un voile derrière le volet (hors de lui : il couvre la page, un clic ferme la fiche) — sauf en plan.
  return createPortal(<>
    {!enPlan && ordi ? <button type="button" className="fd-fond" data-fd-fond="" aria-label={tr('a11y.fiche.fermer')} tabIndex={-1} onClick={onFermer}/> : null}
    <div ref={racine} className={'vrm-fp fd fd2' + (depuis ? ' is-depuis-ligne' : '') + (enPlan ? ' sb-plan fd-plan' : '') + (ordi ? ' fd-ordi' : '')} role="dialog" aria-modal={enPlan ? 'false' : 'true'} data-sb-plan={enPlan ? '1' : undefined} aria-label={nomFiche ? tr('a11y.fiche.nom', { n: String(nomFiche) }) : tr('fiche.heros')} data-fiche-paire={nomFiche} data-fiche-contexte-ouvert={ctx || undefined}
      data-fiche-ligne-cle={depuis ? depuis.cle : undefined} data-fiche-identite={depuis ? (ligneRes ? ligneRes.etat + ':' + (ligneRes.par || '') : '') : 'numero'} data-fiche-lecture-en-cours={lecture ? '1' : '0'} data-fd-directe="1" data-noswipe="1">
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="fd-cadre" ref={cadre}>
        <div className="fd-barre" data-fd-barre="">
          <Rond data-fiche-retour="" data-fiche-fermer={depuis || !onRetour ? '' : undefined} aria-label={depuis ? tr('fiche.retour') : tr('fd.retour')} onClick={onRetour || onFermer}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></Rond>
          {ctxHeros ? <span className="fd-ctx" data-fiche-heros-ctx="">{codeHeros ? <>{`${ctxHeros} · `}<span className="vrm-sensible" data-stream-type="code" data-fiche-heros-code="">{codeHeros}</span></> : [ctxHeros, depuis && depuis.sous].filter(Boolean).join(' · ')}</span> : <span className="fd-ctx"/>}
          {p && !ordi ? <Rond data-fd-plus-ouvrir="" aria-label={tr('fd.plus.titre')} aria-expanded={plusOuvert} onClick={() => setPlusOuvert(true)}>{I('more', 20)}</Rond>
            : !p || ordi ? <Rond aria-label="Fermer la fiche" data-fiche-fermer="" onClick={onFermer}>{I('close', 20)}</Rond> : null}
        </div>
        <div className="fd-corps">
          {!p && !depuis ? <p className="vrm-fp-vide" data-fiche-vide="">{lecture ? `Je lis l’histoire de ${motsVendeur().ce}…` : `Le N°${num} n’est pas un numéro.`}</p> : null}
          {(p || depuis) ? <div className={'fd-tete' + (photo ? '' : ' is-sans-photo')} data-fiche-heros={ctx || 'numero'} data-fiche-photo-vedette={photo ? '1' : '0'} aria-label={tr('fiche.heros')}>
            {photo && Photo
              ? <button type="button" className="fd-photo" data-fiche-heros-photo="1" data-fd-photo-agrandir={toutesPhotos.length} aria-label={toutesPhotos.length > 1 ? tr('fd.photo.voirN', { n: toutesPhotos.length }) : tr('fd.photo.agrandir')} onClick={() => setGrand(true)}>{Photo(photo)}{toutesPhotos.length > 1 ? <span className="fd-photo-n num" aria-hidden="true">{toutesPhotos.length}</span> : null}</button>
              : <span className="fd-photo is-vide" data-fiche-heros-photo="0" aria-hidden="true"><Silhouette/></span>}
            <div className="fd-t">
              {plaque}
              <h1 className="fd-nom" data-fd-titre="" title={titre}>{motsInsecables(titre)}</h1>
              {lEtat ? <span className={'fd-etat' + (lEtat.ambre ? ' is-am' : '') + (lEtat.rouge ? ' is-rouge' : '')} data-fd-etat={lEtat.cle} data-fd-ambre={lEtat.ambre ? '1' : '0'} data-fd-limite={lEtat.limite ? (lEtat.limite.jour || '') : undefined}>{tr(lEtat.court, lEtat.vars)}</span>
                : depuis && depuis.prix ? <span className="fd-etat" data-fiche-heros-prix={depuis.prix}>{depuis.prix}</span> : null}
              {neuve ? <span className="fd-etat" data-fiche-neuve="">Photos à prendre</span> : null}
              {p && p.ancienNumero ? <span className="fd-etat">Ancien numéro (d’avant la remise à zéro)</span> : null}
            </div>
          </div> : null}
          {double ? <p className="vrm-fp-double fd-double" role="alert" data-fiche-double="1" data-fiche-choisit="0">Deux {motsVendeur().noms} présent{motsVendeur().e}s portent le N°{p.num} : vérifie là où {motsVendeur().elle}s sont rangé{motsVendeur().e}s avant d’emballer ou d’imprimer.</p> : null}
          {/* La note privée de la paire, quand il y en a une : une information, donc sous les yeux (rien quand elle est vide). */}
          {p && plus && plus.noteLue ? <div className="fd-note" data-fd-note-lue="">{plus.noteLue}</div> : null}
          {p ? <GrilleFaits faits={faits} etat={etat} edition={edition} setEdition={setEdition} portes={portes} I={I}/> : null}
          {A && !double ? <Sites sites={A.sites} manques={lecture ? [] : A.sitesManques} prixRef={prixRef} I={I}/> : null}
          <BlocAction a={action} I={I} Photo={Photo} relier={relier} onBordereau={onBordereau} onPrix={onPrix} onSaisir={saisir} num={p && p.num}/>
          {sansPaire}
          {p ? <>
            {/* Ce que VRM demande de trancher sur cette paire (« Tu l'as encore ? », à retirer ailleurs, même photo) :
                rendu seulement quand il y a une question — sinon rien (chacun rend null). */}
            {plus && plus.questions ? <div className="fd-questions" data-fd-questions="">{plus.questions}</div> : null}
            {tuiles.length ? <div className="fd-tuiles" role="group" aria-label={tr('fd.gestes.titre')} data-fd-tuiles={tuiles.join(',')}>
              {tuiles.map((t) => <button key={t} type="button" className="fd-tuile" data-fd-tuile={t} aria-pressed={tuile === t ? 'true' : undefined}
                {...(t === 'prix' ? { 'data-fiche-prix': '' } : t === 'publier' ? { 'data-fiche-publier-ailleurs': '' } : t === 'republier' ? { 'data-fiche-republier': '' } : t === 'dupliquer' ? { 'data-fiche-dupliquer': '' } : t === 'emballer' ? { 'data-fiche-emballer': '' } : t === 'bordereau' ? { 'data-fiche-bordereau-tuile': p.txAPoster } : {})}
                onClick={() => toucherTuile(t)}><span className="fd-tuile-ic" aria-hidden="true">{I(ICONE_TUILE[t], 20)}</span><span className="fd-tuile-l">{tr('fd.tuile.' + t)}</span></button>)}
            </div> : null}
            {contenuTuile ? <div className="fd-tuile-vue" data-fd-tuile-vue={tuile}>{contenuTuile}</div> : null}
            {/* (16 nov., bancs-rouges-a ; 19 nov. : SUR la fiche) La place « contexte » de la LIGNE (le Stock : où est la paire,
                « Retirer de la case », « Déplacer » ; l'annonce : son état, ses seuils d'offre ; la vente : son récapitulatif). */}
            {depuis ? <section className="vrm-fp-contexte fd-ligne" data-fiche-contexte={ctx} aria-label={tr(CLE_CTX[ctx] || 'fiche.ctx.vente')} ref={slotCtx}/> : null}
            <section className="fd-histoire" data-fd-histoire={toutHist ? 'tout' : 'repliee'} aria-label={tr('fd.seg.histoire')}>
              <h2 className="fd-titre-sec">{tr('fd.seg.histoire')}</h2>
              <Histoire lignes={hist} tout={toutHist} lien={achatRelie}/>
              {toutVoir}
            </section>
            {ordi && rares ? <section className="fd-rares" data-fd-rares="" aria-label={tr('fd.plus.titre')}>{rares}</section> : null}
            {lecture ? <p className="fd-vide" data-fiche-lecture="">Lecture en cours…</p> : null}
          </> : null}
        </div>
        {feuillePlus}
        {grand && toutesPhotos.length && Photo ? <Visionneuse photos={toutesPhotos} Photo={Photo} I={I} titre={titre} onFermer={() => setGrand(false)}/> : null}
      </div>
    </div></>, document.body);
}
