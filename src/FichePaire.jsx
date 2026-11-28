// ── LA FICHE COMPLÈTE D'UNE PAIRE (1er nov., maquette « numero-B-fiche-paire ») ─
// Le parcours de la paire, étape par étape, tel que `parcoursPaire`
// (src/fichePaire.js) l'a lu PAR IDENTITÉ. Une étape lue : à l'encre, pastille
// pleine. Pas su : « — » et la raison. Pas (encore) arrivée : grisée — jamais
// inventée. Aucune couleur (§7) sauf le rouge de deux paires sous ce N° (§5).
import React from 'react';
import { motsVendeur, vendCourant } from './profilVendeur.js';
import {HistoriqueModifications} from './OutilsParcours.jsx';
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
import { articleFiche, RARES } from './ficheProduit.js';
import Fiche from './natif/ecrans/Fiche.jsx';
import CourbeAnnonce from './natif/CourbeAnnonce.jsx';   // (21 nov., ext. 5.428) la courbe de son annonce
import { lireTout, load as chargerCle, save as ecrireCle } from './App.jsx';
import BlocFicheSneakers from './sneakers/BlocFiche.jsx';   // (28 nov., lot sneakers-cote) référence fabricant, pointure, étiquettes du N°
const lireCourbe = (q) => lireTout(q, { strict: true });   // (19 nov.) la vue « VRM natif » de la fiche
import { Herite, Bouton, Vignette, Rangee, Glyphe, poserIcone, iconePosee } from './natif/index.js';
// (19 nov.) « Vendu ailleurs » sur la fiche : son bouton d'ouverture est une RANGÉE de la grille des gestes (icône + libellé,
// 44 px) ; ses boutons « Annuler » / « Valider » sont des boutons natifs teintés (le seul plein reste celui de la fiche).
const BoutonRangeeGeste = ({ children, onClick, variante, className, type, ...attrs }) => (attrs['data-vendu-ailleurs-ouvrir'] != null
  ? <Rangee icone={<Glyphe nom="check" taille={22}/>} titre={children} onClick={onClick} attrs={attrs}/>
  : <Bouton variante={variante === 'primaire' ? 'teinte' : 'texte'} type={type || 'button'} onClick={onClick} attrs={attrs}>{children}</Bouton>);

// (14 nov., proposition 62) Ouverte DEPUIS une ligne de liste : ce que la ligne est (le titre de sa partie).
const CLE_CTX = { vente: 'fiche.ctx.vente', colis: 'fiche.ctx.colis', achat: 'fiche.ctx.achat', annonce: 'fiche.ctx.annonce', stock: 'fiche.ctx.stock', retrait: 'fiche.ctx.retrait', journee: 'fiche.ctx.journee' };
// La silhouette d'une basket en trait (une fiche sans photo, état vide illustré — direction « Atelier »).
const Silhouette = () => (
  <svg className="vrm-fp-silhouette" viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 30c0-3 1-6 3-8l9-10c1-1 3-1 4 0l3 3c2 2 5 3 8 3h4c4 0 8 2 11 5l7 5c4 2 7 3 7 6v2H4z"/><path d="M4 33h60M18 14l3 4M23 12l3 4M28 14l2 3"/>
  </svg>
);
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


// ══ (19 nov. 2026, « FICHE DIRECTE », design « VRM natif » — docs/passation/2026-11-19-fiche-directe.md) ═════════════
// Julien : « je dois cliquer sur la paire puis cliquer sur les points pour avoir des informations. Ce n'est pas normal,
// ça doit être beaucoup plus accessible et beaucoup plus simple », puis « l'outil doit être pratique, pas chiant » et
// « Vinted n'est pas la plateforme principale des autres ». Le 15 nov. il avait rejeté une fiche de six écrans.
// Ce fichier est l'ADAPTATEUR : il reçoit ce que la coque a lu (le parcours, les sites, les gestes), en fait UN ARTICLE
// (`articleFiche`, src/ficheProduit.js — pur) et le donne à la VUE native (src/natif/ecrans/Fiche.jsx), qui ne porte
// aucune règle. Plus d'onglets Argent · Sites · Histoire ; plus de feuille « ⋯ » obligatoire : « ⋯ » ne garde que le
// rare (Certificat, Son N°). « Rappel » et « Emballer » ne sont plus des gestes de la fiche (audit d'utilité, §4.6).
// Les blocs d'avant (l'état, le parcours, l'histoire du N°…) vivent dans « Tout voir » de l'histoire, posés tels quels.
const NOM_SITE_FD = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const dateFd = (t) => { const d = new Date(t); if (!Number.isFinite(d.getTime())) return ''; return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
const ICONE_TUILE = { note: 'pencil', photos: 'camera', certificat: 'doc', prix: 'tag', publier: 'shop', republier: 'sync', dupliquer: 'copy', taille: 'grid', bordereau: 'printer', numero: 'journal' };
const ATTRS_TUILE = { prix: { 'data-fiche-prix': '' }, publier: { 'data-fiche-publier-ailleurs': '' }, republier: { 'data-fiche-republier': '' }, dupliquer: { 'data-fiche-dupliquer': '' } };

export default function FichePaire({ owner = '', p, etat = null, histoNum = null, lecture = false, num, onFermer, onRetour, onBordereau, onPrix, onPrixAchat = null, onDupliquer, onPublierAilleurs, onRepublier = null, onSource, neuve = null, onCopier, Photo, Icon, note = null, plus = null, sites = null, sitesManques = undefined, sitesAutres = null, sitesPasLus = undefined, sitesMontres = null, onPublierSur = null, taille: tailleLue = '', photos = null, edits = null, achatParNum = null, siVendue = null, relier = null, achatRelie = null, ligne = null, ligneRes = null, onChoisirNum = null, extraTemps = null, outilsIdees = null , forfait = null, coutVente = null, retraits = null }) {
  const [vueFiche, setVueFiche] = useVueFiche();
  const slotCtx = React.useCallback((el) => poserSlot('contexte', el), []);
  const slotAct = React.useCallback((el) => poserSlot('actions', el), []);
  const [edition, setEdition] = React.useState(null);     // le fait en cours de saisie sur place ('achat' | 'mini')
  const numCle = p ? p.num : '';
  React.useEffect(() => { setEdition(null); }, [numCle]);
  React.useEffect(() => { if (Icon && !iconePosee()) poserIcone(Icon); }, [Icon]);
  if (typeof document === 'undefined') return null;
  const lignesSites = Array.isArray(sites) ? sites : [];
  const depuis = ligne && ligne.cle ? ligne : null;
  const ctx = depuis ? depuis.contexte : '';
  const double = !!(p && p.double);
  const taille = p ? (String(tailleLue || '') || (neuve && neuve.taille) || p.taille || '') : '';
  const ctxHeros = ctx ? tr(CLE_CTX[ctx] || 'fiche.ctx.vente') : '';
  // Le prix d'achat : tapé SUR PLACE (`edits.achat` — la fiche de l'annonce, sinon le N°), sinon la feuille d'avant.
  const achatSurPlace = !!(p && edits && edits.achat && !p.ancienNumero && !double && !achatRelie);
  const achatConnu = !!(p && ((p.resume && p.resume.achat != null) || Number.isFinite(achatParNum)));
  const saisirFeuille = p && onPrixAchat && p.idFiche && !p.ancienNumero && !achatConnu ? () => onPrixAchat(p) : null;
  const saisir = achatSurPlace && !achatConnu ? () => { setEdition('achat'); try { const c = document.querySelector('[data-fiche-paire] [data-fd-fait="achat"]'); if (c) c.scrollIntoView({ block: 'center' }); } catch (_) {} } : saisirFeuille;
  const portes = p ? {
    achat: achatSurPlace ? (f, t) => edits.achat(t) : null,
    relier: relier && relier.onAutre ? () => relier.onAutre() : (saisirFeuille || null),
    lien: achatRelie ? () => {} : null,
    prix: onPrix && !neuve ? () => onPrix(p.num, true) : null,
    mini: edits && edits.mini ? (f, t) => edits.mini(f.id, t) : null,
    place: onSource ? () => onSource({ stock: p.num }) : null,
  } : {};
  // L'ARTICLE (src/ficheProduit.js, `articleFiche`) : tout ce que la fiche montre, rangé une fois — la vue ne calcule rien.
  // (16 nov.) Ouverte depuis une ligne de COLIS, la fiche porte déjà SON geste du bordereau (les actions de la ligne).
  const A = p ? articleFiche(p, { sites: lignesSites, sitesManques: lecture ? [] : sitesManques, sitesAutres: Array.isArray(sitesAutres) ? sitesAutres : [],
    sitesPasLus: lecture ? undefined : sitesPasLus, sitesMontres, peutPublier: !!onPublierSur && !neuve && !(p && p.ancienNumero), etat, taille, photos, neuve, achatParNum, siVendue, relie: !!achatRelie, dateCourte: dateFd,
    peut: { achat: !!portes.achat, relier: !!portes.relier, prix: !!portes.prix, mini: !!portes.mini, place: !!portes.place },
    action: { proposition: relier ? relier.proposition : undefined, peutRelier: !!(relier && (relier.onRelier || relier.onAutre)), peutBordereau: !!onBordereau, peutBaisser: !!onPrix && !neuve, peutSaisir: !!saisir },
    dispo: { neuve, note: !!((plus && plus.note) || note), atelier: !!(plus && plus.atelier), onPrix, onPublierAilleurs, onRepublier, onDupliquer, outilsIdees, onBordereau: ctx === 'colis' ? null : onBordereau, histoNum } }) : null;
  const r = A ? A.p.resume : null;
  const faits = A ? A.faits : [];
  // (15 nov., rouges-connus) La paire lue sans titre prend celui de la LIGNE touchée (la même annonce, par identité).
  const titre = A ? (A.titre || (A.p.etat === 'rien' ? 'N° jamais servi' : (depuis && depuis.titre) || 'Sans titre')) : ((depuis && depuis.titre) || tr('fiche.sansTitre'));
  const I = (n, s = 18) => (Icon ? <Icon name={n} size={s}/> : null);
  // LE BOUTON PRINCIPAL (un seul plein, collé en bas) et ce qui le situe (l'achat proposé, la date limite) — jamais une phrase d'explication.
  const a = A ? A.action : null;
  let plein = null, proposition = null, ligneAction = null;
  if (a && a.sorte === 'relier') {
    const pr = a.proposition; const achat = pr && pr.achat;
    const autre = () => relier && relier.onAutre && relier.onAutre();
    if (pr) {
      const d = Number.isFinite(pr.recuMs) ? dateFd(pr.recuMs) : achat && achat.date ? dateFd(Date.parse(achat.date)) : '';
      plein = { libelle: pr.texte ? tr('fd.relier.plein', { prix: pr.texte }) : tr('fd.relier.pleinSansPrix'), icone: 'link', onClick: () => relier && relier.onRelier && relier.onRelier(pr), attrs: { 'data-fd-action': 'relier', 'data-fd-propose': String(pr.tx || ''), 'data-fd-relier': String(pr.tx || ''), 'data-fd-relier-cents': pr.centimes == null ? '' : String(pr.centimes) } };
      proposition = { photo: (achat && achat.photo) || '', titre: pr.titre || (achat && achat.title) || '', onAutre: autre, attrs: { 'data-fd-achat-propose': String(pr.tx || ''), 'data-fd-achat-niveau': pr.niveau || '' },
        sous: [d ? tr(pr.recuMs != null ? (pr.recuSource === 'livraison' ? 'fd.relier.livreeLe' : 'fd.relier.retireeLe') : 'fd.relier.commandeeLe', { date: d }) : '', pr.texte ? tr('fd.relier.payee', { prix: pr.texte }) : ''].filter(Boolean).join(' · ') };
    } else if (pr === undefined) ligneAction = { titre: tr('fd.relier.cherche'), attrs: { 'data-fd-action': 'relier', 'data-fd-propose': 'lecture', 'data-fd-relier-etat': 'lecture' } };
    else plein = { libelle: tr('fd.relier.choisir'), icone: 'link', onClick: autre, attrs: { 'data-fd-action': 'relier', 'data-fd-propose': '', 'data-fd-relier-autre': '', 'data-fd-relier-etat': 'aucun' } };
  } else if (a && a.sorte === 'bordereau') {
    plein = { libelle: tr('fd.bord.plein'), icone: 'printer', onClick: () => onBordereau && onBordereau(a.tx), attrs: { 'data-fd-action': 'bordereau', 'data-fiche-bordereau': a.tx || '' } };
    // (16 nov., lot ecrans-restes) La date limite d'envoi, par la règle de Colis (l'e-mail du bordereau, sinon estimée).
    if (a.pret || a.limite) ligneAction = { titre: a.pret ? tr('fd.bord.pret') : tr('fd.bord.titre'), valeur: a.limite ? a.limite.texte : '', ambre: !!(a.limite && a.limite.ambre), attrs: a.limite ? { 'data-fd-limite': a.limite.jour || '', 'data-fd-limite-estimee': a.limite.estimee ? '1' : '0' } : null };
  } else if (a && a.sorte === 'baisser') {
    plein = { libelle: tr('fd.baisser.plein'), icone: 'tag', onClick: () => onPrix && onPrix(p.num), attrs: { 'data-fd-action': 'baisser', 'data-fiche-prix': '', 'data-fd-baisser': p.num } };
    const t = a.jours != null && a.offres === 0 ? tr('fd.baisser.aucuneOffre', { n: a.jours }) : a.jours != null && a.offres ? tr('fd.baisser.offres', { n: a.offres, j: a.jours }) : '';
    if (t) ligneAction = { titre: t, attrs: { 'data-fd-offres': a.offres == null ? '' : String(a.offres) } };
  } else if (a && a.sorte === 'saisir') plein = { libelle: tr('fd.saisir.plein'), icone: 'pencil', onClick: saisir, attrs: { 'data-fd-action': 'saisir', 'data-fiche-saisir-achat': '' } };
  // LES GESTES, en rangées (audit d'utilité §4.6) : visibles — Prix, Republier, Ailleurs, Dupliquer, Autre taille, Photos, Note,
  // Bordereau ; derrière « ⋯ » : Certificat, Son N°. Un geste direct, ou ce qu'il montre (une feuille : la note, l'atelier…).
  const faire = { prix: () => onPrix(p.num), publier: () => onPublierAilleurs(p.num), republier: () => onRepublier(p.num), dupliquer: () => onDupliquer(p.num), bordereau: () => onBordereau(p.txAPoster) };
  const contenu = { note: (plus && plus.note) || note, photos: plus && plus.atelier, certificat: plus && plus.atelier, taille: outilsIdees, numero: histoNum ? <HistoireNumero h={histoNum}/> : null };
  const geste = (t) => ({ cle: t, libelle: tr('fd.tuile.' + t), icone: ICONE_TUILE[t], onClick: faire[t] || null, contenu: faire[t] ? null : contenu[t], attrs: t === 'bordereau' ? { 'data-fiche-bordereau-tuile': p.txAPoster } : ATTRS_TUILE[t] });
  const gestes = A ? A.gestes.filter((t) => !RARES.includes(t)).map(geste) : [];
  const rares = A ? A.gestes.filter((t) => RARES.includes(t)).map(geste) : [];
  // L'HISTOIRE : ses étapes en mots (l'achat relié dit son vendeur, sa date, son prix).
  // (19 nov.) Le montant (sinon la date) à droite de l'étape, le reste dessous : une étape sans autre détail tient sur une ligne.
  // (19 nov. soir) La frise : la date à gauche, le titre et son montant, le reste dessous.
  const lignesHist = A ? A.histoire.map((l) => ({ cle: l.cle, ambre: l.ton === 'am', titre: l.libre || tr(l.titre), date: l.at != null ? dateFd(l.at) : '', montant: l.montant != null ? eur(l.montant) : '',
    reste: [l.vendeur ? tr('fd.h.vendeur', { nom: l.vendeur }) : '', l.compte || '', l.sites && l.sites.length ? l.sites.map((x) => NOM_SITE_FD[x] || x).join(', ') : '', l.detail ? tr(l.detail, { n: l.n }) : ''].filter(Boolean).join(' · ') })) : [];
  // « Tout voir » : le détail d'avant, posé tel quel sous l'histoire ouverte — rien n'est supprimé, rien n'est derrière « ⋯ ».
  const toutVoir = p ? (<>
    {!double && r && r.detail && !faits.some((c) => c.cle === 'si-vendue') ? <BeneficeArticleDetail detail b={r.detail} seulement={r.detail.plateforme === 'eBay' ? ['vente', 'site', 'saisis'] : ['site', 'saisis']}/> : null}
    {/* (21 nov., lot rentabilite) Le forfait d'emballage qu'il règle (éteint par défaut), là où l'emballage de cette vente n'est pas noté. */}
    {!double && r && r.detail && forfait && (r.detail.detailFrais || []).some((l) => l.cle === 'emballage' && (l.src === 'aucun' || l.src === 'forfait')) ? forfait : null}
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
    {neuve && onCopier ? <button type="button" className="vrm-lien-action" data-fiche-copier="" onClick={() => onCopier(neuve)}>Copier le texte</button> : null}
    {p.manques.length ? <p className="vrm-fp-note" data-fiche-manques={p.manques.length}>Pas pu lire : {p.manques.join(', ')}.</p> : null}
  </>) : null;
  const nomFiche = (p && p.num) || num || '';
  const sansPaire = !p && depuis ? (
    <Herite attrs={{ 'data-fiche-sans-paire': ligneRes ? ligneRes.etat : 'aucun', role: 'note' }}>
      {ligneRes && ligneRes.etat === 'lot' ? <>
        <p className="vrm-fp-sans-paire-t">{tr('fiche.lotTitre', { n: String(ligneRes.nums.length) })}</p>
        <div className="vrm-fp-lot" data-fiche-lot={ligneRes.nums.join(',')}>
          {ligneRes.nums.map((n) => <Bouton key={n} onClick={() => onChoisirNum && onChoisirNum(n)} attrs={{ 'data-fiche-lot-num': n }}>{`N°${n}`}</Bouton>)}
        </div>
      </> : ligneRes && ligneRes.etat === 'lecture' ? <p className="vrm-fp-sans-paire-t" data-fiche-lecture="">{tr('fiche.lecture')}</p>
        : ligneRes && ligneRes.etat === 'passu' ? <p className="vrm-fp-sans-paire-t">— {tr('fiche.passu')}</p>
        : <>
          <p className="vrm-fp-sans-paire-t">{tr('fiche.pasDePaire')}</p>
          <p className="vrm-fp-sans-paire-g" data-fiche-geste-relier="">{tr('fiche.gesteRelier.' + (ctx === 'achat' ? 'achat' : ctx === 'annonce' ? 'annonce' : 'vente'))}</p>
        </>}
      {/* (21 nov., lot rentabilite — choix n° 41) Une VENTE sans N° relié garde son coût réel : la fiche de CETTE vente (son prix
          d'achat noté, ses frais), par la règle du bénéfice (`beneficeArticle`, posé par Ventes) — ligne par ligne, puis le forfait. */}
      {ctx === 'vente' && coutVente ? <BeneficeArticleDetail detail b={coutVente}/> : null}
      {ctx === 'vente' && coutVente && forfait && (coutVente.detailFrais || []).some((l) => l.cle === 'emballage' && (l.src === 'aucun' || l.src === 'forfait')) ? forfait : null}
    </Herite>
  ) : null;
  const T = {
    plus: tr('fd.plus.titre'), sites: tr('fd.sites.titre'), gestes: tr('fd.gestes.titre'), histoire: tr('fd.seg.histoire'), toutVoir: tr('verre2.fiche.toutVoir'), replier: tr('fd.h.replier'),
    recu: tr('fd.argent.recu'), delier: tr('fd.argent.delier'), achatPropose: tr('fd.relier.propose'), autreAchat: tr('fd.relier.autre'), aucunSite: tr('fd.sites.aucun'), auPlus: tr('fd.argent.auPlus'), auMoins: tr('fd.f.auMoins'),
    pourquoi: tr('fd.pourquoi'),   // (24 nov.) « Pourquoi ? » sous une ligne d'état « pas su »
    agrandir: tr('fd.photo.agrandir'), voirPhotos: (n) => tr('fd.photo.voirN', { n }), sansTitre: tr('fiche.sansTitre'), titre: motsInsecables(titre),
    etat: (e) => tr(e.court, e.vars), libelle: (k) => tr(k), raison: (k) => tr(k), site: (s) => NOM_SITE_FD[s] || s, pasLus: (s) => tr('fd.sites.pasLus', { sites: s }),
    // (21 nov., fiche-sites) L'état de CHAQUE site (src/ficheSites.js) : la date de vente est dans sa colonne, l'état ne la redit pas.
    etatSite: (s) => (['attente', 'corriger', 'refusee'].includes(s.etat) ? tr('vcmod.' + s.etat) : s.etat === 'vendue' ? tr('fd.sites.vendue') : s.etat === 'en-ligne' ? tr('fd.sites.enLigne') : s.etat === 'publiee' ? tr('fd.sites.publiee') : s.etat === 'en-pause' ? tr('fd.sites.enPause') : s.etat === 'hors-ligne' ? tr('fd.sites.horsLigne') : s.etat === 'masquee' ? tr('fd.sites.masquee')
      : s.etat === 'pas-revue' ? (s.jours != null && s.jours >= 1 ? tr('fd.sites.pasRevueJ', { n: s.jours }) : tr('fd.sites.pasRevue')) : s.etat === 'retiree' ? tr('fd.sites.retiree')
      : s.etat === 'pas-publiee' ? tr('fd.sites.pasPubliee') : '—'),
    raisonSite: (s) => (s.raison === 'lecture' ? tr('fd.sites.raisonLecture') : tr('fd.sites.raisonPasLu')),
    dateSite: (s) => (s.dateSorte === 'vente' ? tr('fd.sites.dateVente', { date: dateFd(s.date) }) : tr('fd.sites.dateMise', { date: dateFd(s.date) })),
    publier: tr('fd.sites.publier'), publierSur: (site) => tr('fd.sites.publierSur', { site: NOM_SITE_FD[site] || site }),
    euros: eur, signe, date: dateFd, jours: (n) => tr('fd.f.jours', { n }),
    // (19 nov. soir) la fiche produit : « Ajouter » d'une valeur qui manque, les pastilles, le tableau, les colonnes des sites.
    ajouter: tr('fd.ajouter'), relier: tr('fd.relierCourt'), choisirAction: tr('fd.actions.choisir'), actionsCourt: tr('fd.actions.court'), infos: tr('fd.infos.titre'),
    court: (k) => tr('fd.court.' + (k === 'si-vendue' ? 'benefice' : k)), photoN: (i, n) => tr('fd.photo.n', { i, n }),
    col: { site: tr('fd.col.site'), compte: tr('fd.col.compte'), prix: tr('fd.col.prix'), vues: tr('fd.col.vues'), favoris: tr('fd.col.favoris'), date: tr('fd.col.date'), etat: tr('fd.col.etat'), geste: tr('fd.col.geste') },
    // Les `data-*` d'avant restent sur leur fait (résumé achat / bénéfice / si vendue, état « prix-achat »).
    attrsFait: (f) => (f.cle === 'achat' ? { 'data-fiche-resume-achat': f.cents == null ? '' : f.cents, ...(f.cents == null ? { 'data-fiche-saisir-achat': '' } : {}), ...(etat ? { 'data-etat-ligne': 'prix-achat', 'data-etat-val': etat.prixAchat.cents == null ? '' : etat.prixAchat.cents, 'data-etat-source': etat.prixAchat.source || '' } : {}) }
      : f.cle === 'benefice' ? { 'data-fiche-resume-benefice': f.cents == null ? '' : f.cents, 'data-fiche-benefice-partiel': f.partiel ? '1' : undefined, 'data-fiche-raison-benef': f.brut || undefined }
      : f.cle === 'si-vendue' ? { 'data-fiche-resume-benefice': '', 'data-fiche-si-vendue': f.cents == null ? '' : f.cents, 'data-fiche-benefice-partiel': f.partiel ? '1' : undefined }
      : f.cle === 'prix' ? { 'data-fiche-resume-vente': f.cents == null ? '' : f.cents, ...(f.porte ? { 'data-fiche-prix': '' } : {}) } : null),
  };
  const rendre = { photo: (src) => (Photo ? Photo(src) : null), icone: I, vignette: (src) => <Vignette src={src || ''} alt="" taille={44}/>,
    logo: (site) => (['vinted', 'ebay', 'leboncoin', 'vestiaire'].includes(site) ? <MarquePlateforme site={site} taille={site === 'ebay' ? 11 : 18}/> : I('tag', 20)) };
  return (
    <Fiche article={A} numero={String(nomFiche)} sans={!p && depuis ? depuis : null} titreBarre={nomFiche ? `N° ${nomFiche}` : tr('fiche.heros')} libelleRetour={ctxHeros} onRetour={onRetour || onFermer}
      contexteBarre={ctx} publierSur={p && onPublierSur ? (site) => onPublierSur(p.num, site) : null} textes={T} rendre={rendre} portes={portes} edition={edition} setEdition={setEdition} plein={plein} proposition={proposition} ligneAction={ligneAction}
      gestes={gestes} rares={rares} histoire={p ? { lignes: lignesHist } : null} achatRelie={achatRelie}
      sansNumero={!p && depuis ? (ligneRes && ligneRes.etat === 'lot' ? tr('fiche.lotN', { n: String(ligneRes.nums.length) }) : tr('fiche.sansNum')) : ''}
      suiteEtat={<>{neuve ? <span data-fiche-neuve="">Photos à prendre</span> : null}{p && p.ancienNumero ? <span>Ancien numéro (d’avant la remise à zéro)</span> : null}</>}
      attrs={{ 'data-fiche-paire': nomFiche, 'data-fiche-contexte-ouvert': ctx || undefined, 'data-fiche-ligne-cle': depuis ? depuis.cle : undefined, 'data-fiche-identite': depuis ? (ligneRes ? ligneRes.etat + ':' + (ligneRes.par || '') : '') : 'numero',
        'data-fiche-lecture-en-cours': lecture ? '1' : '0', 'data-fd-directe': '1', 'data-noswipe': '1', 'data-fiche-fermer-par': 'retour' }}
      blocs={{
        alerte: double ? <Herite attrs={{ role: 'alert', 'data-fiche-double': '1', 'data-fiche-choisit': '0', 'data-n-ton': 'doublon' }}>Deux {motsVendeur().noms} présent{motsVendeur().e}s portent le N°{p.num} : vérifie là où {motsVendeur().elle}s sont rangé{motsVendeur().e}s avant d’emballer ou d’imprimer.</Herite>
          : !p && !depuis ? <Herite attrs={{ 'data-fiche-vide': '' }}>{lecture ? `Je lis l’histoire de ${motsVendeur().ce}…` : `Le N°${num} n’est pas un numéro.`}</Herite> : null,
        noteLue: p && plus && plus.noteLue ? plus.noteLue : null,
        sansPaire,
        questions: p && plus && plus.questions ? plus.questions : null,
        // Les places de la LIGNE (`poserSlot`, src/DansFiche.jsx) : son contexte (le Stock : où est la paire ; l'annonce : son état,
        // ses seuils ; la vente : son récapitulatif) et ses gestes — SUR la fiche, toujours montés (la ligne y pose ses éléments).
        contexte: depuis ? <Herite ref={slotCtx} attrs={{ 'data-fiche-contexte': ctx, 'aria-label': tr(CLE_CTX[ctx] || 'fiche.ctx.vente') }}/> : null,
        actions: depuis ? <Herite attrs={{ 'data-fiche-actions': ctx, 'aria-label': tr('fiche.actions') }}><div className="vrm-fp-actions-ligne" ref={slotAct} data-fiche-actions-ligne=""/></Herite> : null,
        retraits: p ? retraits : null,   // (21 nov., ext. 5.426) « Vendue → retirée sur » (src/RetraitsFiche.jsx)
        vendueAilleurs: p && plus && plus.gestes ? (React.isValidElement(plus.gestes) ? React.cloneElement(plus.gestes, { Bouton: BoutonRangeeGeste }) : plus.gestes) : null,
        toutVoir,
        // (21 nov., ext. 5.428, choix 58) son annonce Vinted EN LIGNE (identité : l'id de l'annonce), une lecture projetée.
        // (28 nov., lot sneakers-cote) « Modèle » : la référence (proposée depuis le titre, posée par SON toucher), la pointure,
        // les étiquettes. Jamais une identité (§5) ; pas de cote ici (§3 : la fiche montre une annonce en ligne).
        // (28 nov., main-vert) Sneakers seulement (Julien, 11 nov. : « arrête de faire allusion à des chaussures ») : référence, pointure, cote.
        modele: vendCourant() === 'sneakers' && p && !double && p.num ? <BlocFicheSneakers num={p.num} titre={titre} taille={taille} load={chargerCle} save={ecrireCle}/> : null,
        courbe: (() => { const v = lignesSites.find((x) => x && x.site === 'vinted' && x.etat === 'en-ligne' && /^\d{4,15}$/.test(String(x.id || ''))); return v ? <CourbeAnnonce id={String(v.id)} lire={lireCourbe}/> : null; })(),
        lecture: p && lecture ? <Herite nu attrs={{ 'data-fiche-lecture': '' }}>Lecture en cours…</Herite> : null,
      }}/>
  );
}
