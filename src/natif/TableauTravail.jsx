// ── src/natif/TableauTravail.jsx — LE tableau de travail des listes (19 nov. soir, NATIF.md §2 bis) ───────────────
// Julien (19 nov. soir, captures d'un outil de vendeur) : « je veux que tu fasses les mêmes fonctionnalités, même rendu
// grosso modo, même dans l'app, j'aime bien ce style, les options proposées ». On reprend la STRUCTURE (barre de titre,
// barre d'outils, « N articles », tableau, sélection), pas la marque ni les couleurs : accent bleu VRM, étiquettes douces
// neutres, ambre = un geste à faire, jamais de rouge (le rouge est le doublon de N°, la Plaque le porte).
//
// PRÉSENTATIONNEL : il ne lit aucune donnée et ne porte aucune règle métier. L'écran lui passe des lignes déjà faites
// (mêmes sources, mêmes règles qu'avant : c'est la DISPOSITION qui change) et des fonctions. Ce qu'il fait lui-même :
//   · la recherche dans le texte des lignes (`texte`), le filtre Statut (cases + compteurs), le tri d'une colonne,
//     les colonnes montrées (mémorisées PAR ÉCRAN sur cet appareil), liste ⇄ grille, la sélection.
//   · LES COMPTEURS DU FILTRE STATUT SONT CEUX DES LIGNES QU'IL AFFICHERAIT : comptés sur les lignes reçues après la
//     recherche, avant le filtre Statut lui-même. Cocher « Vendu » seul ⇒ « N articles » = le compteur de « Vendu ».
//
// Props :
//   id            identité de l'écran (mémoire des colonnes / de la vue : `vrm_tableau_{id}`, cet appareil seulement)
//   titre         le titre (dessiné par la coque quand elle le porte)
//   compte        le compte montré dans la pastille (« vendeur_1 ») ; vide ⇒ « Tous les comptes »
//   majLe         ms de la dernière lecture (undefined : en cours · null : pas su) ; onRafraichir() relance la lecture EXISTANTE
//   lignes        undefined (lecture) · null (pas su) · [{ cle, titre, sous?, photo?, texte?, statut, plaque?, grise? … }]
//   statuts       [{ cle, libelle, ton: 'neutre'|'ambre'|'accent' }] — l'ordre du menu ; statutsDefaut [cle] cochés au départ
//   filtres       [{ cle, libelle, valeur, options: [{ cle, libelle, n?, icone? }], onChange }] — les filtres de l'écran (un choix ;
//                 `icone` : le logo d'une plateforme, dans le menu et sur le bouton quand elle est choisie — 25 nov.)
//   colonnes      [{ cle, libelle, num?, tri?(l), rendu?(l), defaut? (true), titreCourt? }] — 'article' et 'statut' sont posées
//   triDefaut     { cle, sens: 'asc'|'desc' } — sans : l'ordre reçu (le plus récent d'abord, la règle de l'écran)
//   actions       [{ cle, libelle, pour?(l) → bool, juger?(lignes) → { ok, raison } }] — « Choisir une action ▾ »
//   onAction(cle, lignes)          lance le chemin EXISTANT de l'action
//   menuLigne(l)  [{ cle, libelle, onClick }] — le « ⋯ » d'une ligne (rien ⇒ pas de ⋯)
//   onOuvrir(l)   toucher une ligne (la fiche)
//   ligneTel(l)   { sousTitre, valeur, detailValeur, plaque, ton } — la rangée de 72 au téléphone
//   unite         (n) → « 54 articles » ; placeholder ; plein (le plein de l'écran quand rien n'est sélectionné)
//   haut          nœud posé sous la barre d'outils (« À régler », un état de lecture) ; pied (phrase)
//   vide / videRecherche / pasSu   les phrases d'un tableau vide · grille (vrai ⇒ liste ⇄ grille) · Icon
//   outilsPlus    nœud posé au bout de la barre d'outils (un lien vers un écran voisin : « Automatisations »)
// Clavier : ↑ ↓ d'une ligne à l'autre, Entrée ouvre, Espace coche, Échap ferme le menu ou vide la sélection, ⌘K « / » cherche.
import GrilleInventaire from './visuel/GrilleInventaire.jsx';   // (24 nov., lot visuel-annonces)
import React from 'react';
import { tr } from '../i18n/index.js';
import { Page, ChampRecherche } from './Page.jsx';
import { Groupe } from './Groupe.jsx';
import { Rangee, Vignette, photoParApp } from './Rangee.jsx';
import { Bouton } from './Bouton.jsx';
import { Feuille } from './Feuille.jsx';
import { Vide } from './Vide.jsx';
import { Attente } from './Attente.jsx';
import { useOrdinateur } from './Coque.jsx';
import { cx } from './outils.js';
import './jetons.css';
import './natif.css';
import './tableau.css';
import './encre-tableaux.css';   // (22 nov. soir) design noir encre, tranche 2

const PAR_PAGE = 100;
const MEMO = (id) => 'vrm_tableau_' + id;
const lireMemo = (id) => { try { const v = JSON.parse(localStorage.getItem(MEMO(id)) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const ecrireMemo = (id, v) => { try { localStorage.setItem(MEMO(id), JSON.stringify(v)); } catch (_) { /* navigation privée : rien gardé */ } };
const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const saisie = (t) => { const g = t && t.tagName; return g === 'INPUT' || g === 'TEXTAREA' || g === 'SELECT' || !!(t && t.isContentEditable); };

// « Mis à jour il y a 3 min » — la phrase de la fraîcheur, recalculée toutes les 30 s.
export function depuisMaj(majLe, maintenant = Date.now()) {
  if (majLe === undefined) return tr('tableau.maj.lecture');
  if (majLe == null || !Number.isFinite(Number(majLe))) return tr('tableau.maj.passu');
  const s = Math.max(0, Math.round((maintenant - Number(majLe)) / 1000));
  if (s < 60) return tr('tableau.maj.instant');
  if (s < 3600) return tr('tableau.maj.min', { n: Math.floor(s / 60) });
  if (s < 86400) return tr('tableau.maj.h', { n: Math.floor(s / 3600) });
  return tr('tableau.maj.j', { n: Math.floor(s / 86400) });
}

// Le menu déroulant d'un bouton de la barre d'outils (à l'ordinateur) : posé sous le bouton, fermé par Échap, un clic
// dehors ou un choix. Au téléphone, le même contenu passe dans une <Feuille>.
function Deroulant({ ouvert, onFermer, libelle, droite = false, large = false, haut = false, children, attrs = null }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('[data-tt-ancre]') === ref.current.parentElement)) onFermer(); };
    const echap = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onFermer(); const b = ref.current && ref.current.parentElement && ref.current.parentElement.querySelector('button'); if (b) b.focus(); } };
    document.addEventListener('pointerdown', dehors, true); document.addEventListener('keydown', echap, true);
    const premier = ref.current && ref.current.querySelector('input, button');
    if (premier) { try { premier.focus({ preventScroll: true }); } catch (_) {} }
    return () => { document.removeEventListener('pointerdown', dehors, true); document.removeEventListener('keydown', echap, true); };
  }, [ouvert, onFermer]);
  if (!ouvert) return null;
  return <div ref={ref} className="n-tt-pop" data-tt-droite={droite ? '1' : undefined} data-tt-large={large ? '1' : undefined} data-tt-haut={haut ? '1' : undefined} role="dialog" aria-label={libelle} {...(attrs || {})}>{children}</div>;
}

// Une case du menu : une case à cocher et son nombre (Statut, Colonnes), ou un choix (filtre, action).
function CaseMenu({ coche, onChange, libelle, n = null, attrs = null, indisponible = false, raison = '' }) {
  return (
    <label className="n-tt-case" data-tt-coche={coche ? '1' : '0'} title={raison || undefined} {...(attrs || {})}>
      <input type="checkbox" className="n-tt-case-boite" checked={!!coche} disabled={indisponible} title={raison || undefined} onChange={onChange}/>
      <span className="n-tt-case-libelle">{libelle}</span>
      {n != null ? <span className="n-tt-case-n" data-tt-n={String(n)}>{n}</span> : null}
    </label>
  );
}
function ChoixMenu({ choisi, onClick, libelle, n = null, attrs = null, indisponible = false, raison = '', icone = null }) {
  return (
    <button type="button" className="n-tt-choix" role="menuitemradio" aria-checked={choisi ? 'true' : 'false'} aria-disabled={indisponible ? 'true' : undefined} title={raison || undefined}
      onClick={indisponible ? undefined : onClick} {...(attrs || {})}>
      {icone}<span className="n-tt-choix-libelle">{libelle}{raison ? <span className="n-tt-choix-raison">{raison}</span> : null}</span>
      {n != null ? <span className="n-tt-case-n">{n}</span> : null}
      <span className="n-tt-choix-coche" aria-hidden="true">{choisi ? '✓' : ''}</span>
    </button>
  );
}

// (27 nov.) UN filtre du tableau, seul, hors du tableau (au téléphone, la liste de « Terminées » de Ventes n'est pas un
// TableauTravail) : le MÊME bouton de la barre d'outils, les MÊMES choix, la MÊME feuille qu'au téléphone dans le tableau,
// les MÊMES `data-tt-*`. `filtre` : { cle, libelle, valeur, onChange, options: [{ cle, libelle, n? }] } (la forme de `filtres`).
export function FiltreSeul({ filtre: f, attrs = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  if (!f || !Array.isArray(f.options) || f.options.length < 2) return null;
  const o = f.options.find((x) => x.cle === f.valeur);
  const actif = !!(o && f.options[0] && o.cle !== f.options[0].cle);
  return (
    <span className="n-tt-ancre n-tt-filtre-seul" data-tt-ancre="" {...(attrs || {})}>
      <button type="button" data-n-famille="second" className="n-tt-bouton" data-tt-ouvre={'filtre:' + f.cle} data-tt-actif={actif ? '1' : undefined} aria-haspopup="true" aria-expanded={ouvert ? 'true' : 'false'}
        aria-label={actif ? f.libelle + ' · ' + o.libelle : f.libelle} onClick={() => setOuvert(true)} data-tt-filtre={f.cle} data-tt-filtre-valeur={f.valeur}>
        <span className="n-tt-bouton-libelle">{actif ? o.libelle : (f.options[0] || {}).libelle || f.libelle}</span><span className="n-tt-chevron" aria-hidden="true"/>
      </button>
      <Feuille ouverte={ouvert} onFermer={() => setOuvert(false)} titre={f.libelle} attrs={{ 'data-tt-feuille': 'filtre:' + f.cle }}>
        <div className="n-tt-pop-liste" role="menu" aria-label={f.libelle}>
          {f.options.map((x) => <ChoixMenu key={x.cle} choisi={f.valeur === x.cle} libelle={x.libelle} n={x.n != null ? x.n : null} onClick={() => { f.onChange(x.cle); setOuvert(false); }} attrs={{ 'data-tt-filtre-choix': f.cle + ':' + x.cle }}/>)}
        </div>
      </Feuille>
    </span>
  );
}

function Etiquette({ ton = 'neutre', children }) {
  if (!children) return <span className="n-tt-vide-cellule">—</span>;
  return <span className="n-tt-etiquette" data-tt-ton={ton}>{children}</span>;
}

export function TableauTravail({ id, titre = '', compte = '', majLe = undefined, onRafraichir = null, rafraichit = false,
  lignes, statuts = [], statutsDefaut = null, filtres = [], colonnes = [], triDefaut = null,
  actions = [], onAction = null, menuLigne = null, onOuvrir = null, ligneTel = null,
  unite = (n) => tr('tableau.articles', { n }), placeholder = '', plein = null, haut = null, pied = '',
  vide = '', videRecherche = '', pasSu = '', grille = true, Icon = null, attrs = null, enfants = null, outilsPlus = null, groupe = null, avantOutils = null, ligneChoisie = '', cases = true, coches = null, onCocher = null, iconeVide = 'search', actionPasSu = null, carteGrille = null, carteCorps = 0 }) {
  // `iconeVide` : l'icône d'un tableau vide sans filtre (Ventes : le carton) ; `actionPasSu` : le geste d'une lecture ratée (« Réessayer »).
  // `cases={false}` : pas de colonne de cases (une liste sans geste en série : Ventes · En route).
  // `coches` (Set) + `onCocher(cles[], on)` : les cases sont CELLES DE L'ÉCRAN (Ventes · À envoyer : le lot d'impression, cochées
  // d'office là où le bordereau est prêt) — le tableau ne tient alors aucune sélection à lui et ne montre pas sa barre de sélection.
  // `avantOutils` (20 nov., Ventes en tableau) : un nœud posé entre la barre de titre et la barre d'outils (le segmenté de Ventes).
  // `ligneChoisie` : la clé de la ligne dont le détail est ouvert à côté (teintée, `aria-current`).
  // `groupe(l)` (20 nov., « divise par comptes ») ⇒ { cle, titre } : sans tri choisi, un INTERTITRE à chaque nouveau groupe
  // (les lignes arrivent déjà rangées par groupe). Un tri par colonne mélange les groupes : plus d'intertitre.
  const ordinateur = useOrdinateur();
  const memo0 = React.useMemo(() => lireMemo(id), [id]);
  const [q, setQ] = React.useState('');
  const [statutsSel, setStatutsSel] = React.useState(() => new Set(statutsDefaut || []));
  const [tri, setTri] = React.useState(() => (memo0.tri && memo0.tri.cle && colonnes.some((c) => c.cle === memo0.tri.cle) ? memo0.tri : triDefaut));
  const [cachees, setCachees] = React.useState(() => {
    if (Array.isArray(memo0.cachees)) return new Set(memo0.cachees.map(String));
    return new Set(colonnes.filter((c) => c.defaut === false).map((c) => c.cle));
  });
  const [vue, setVue] = React.useState(() => (grille && memo0.vue === 'grille' ? 'grille' : 'liste'));
  const [selPropre, setSel] = React.useState(() => new Set());
  const pilote = !!(coches && onCocher);
  const sel = pilote ? coches : selPropre;
  const [action, setAction] = React.useState(null);
  const [menu, setMenu] = React.useState('');            // 'action' · 'statut' · 'colonnes' · 'filtre:<cle>' · 'ligne:<cle>'
  const [max, setMax] = React.useState(PAR_PAGE);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  const refRacine = React.useRef(null);
  const refChamp = React.useRef(null);
  React.useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(t); }, []);
  React.useEffect(() => { setMaintenant(Date.now()); }, [majLe]);
  // (21 nov., Julien à l'ordinateur : « on doit glisser de gauche à droite pour tout voir ») Les colonnes montrées sur SON choix
  // malgré le repli automatique (`forcees`, mémorisées comme les cachées).
  const [forcees, setForcees] = React.useState(() => new Set(Array.isArray(memo0.forcees) ? memo0.forcees.map(String) : []));
  React.useEffect(() => { ecrireMemo(id, { cachees: [...cachees], forcees: [...forcees], vue, tri }); }, [id, cachees, forcees, vue, tri]);
  React.useEffect(() => { setMax(PAR_PAGE); }, [q, statutsSel, lignes]);

  const liste = Array.isArray(lignes) ? lignes : [];
  // 1) la recherche ; 2) les compteurs ; 3) le filtre Statut ; 4) le tri.
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const cherchees = mots.length ? liste.filter((l) => { const t = sansAccent(l.texte != null ? l.texte : [l.titre, l.sous].join(' ')); return mots.every((m) => t.includes(m)); }) : liste;
  const comptes = React.useMemo(() => { const c = {}; for (const s of statuts) c[s.cle] = 0; for (const l of cherchees) if (l.statut in c) c[l.statut] += 1; return c; }, [cherchees, statuts]);
  const filtrees = statutsSel.size ? cherchees.filter((l) => statutsSel.has(l.statut)) : cherchees;
  const colTri = tri ? colonnes.find((c) => c.cle === tri.cle) : null;
  const affichees = React.useMemo(() => {
    if (!colTri) return filtrees;
    const val = colTri.tri || ((l) => l[colTri.cle]);
    const s = tri.sens === 'asc' ? 1 : -1;
    return filtrees.map((l, i) => ({ l, i, v: val(l) })).sort((a, b) => {
      const av = a.v, bv = b.v;
      const an = av == null || av === '', bn = bv == null || bv === '';
      if (an || bn) return an && bn ? a.i - b.i : an ? 1 : -1;        // « pas su » toujours en bas, l'ordre reçu gardé
      const r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'fr', { numeric: true });
      return r ? r * s : a.i - b.i;
    }).map((x) => x.l);
  }, [filtrees, colTri, tri]);
  const visibles = affichees.slice(0, max);
  // (23 nov., revue UX P2) Le nombre d'un intertitre de groupe = ses lignes AFFICHÉES (après recherche et filtres), sur le même
  // compte que « N annonces » en tête : une seule règle de comptage. `g.titre` peut être une fonction (n, total) ⇒ nœud.
  const nGroupe = React.useMemo(() => { if (!groupe) return null; const m = new Map(), t = new Map();
    for (const l of affichees) { const g = groupe(l); if (g) m.set(g.cle, (m.get(g.cle) || 0) + 1); }
    for (const l of liste) { const g = groupe(l); if (g) t.set(g.cle, (t.get(g.cle) || 0) + 1); }
    return { n: (k) => m.get(k) || 0, total: (k) => t.get(k) || 0 }; }, [affichees, liste, groupe]);
  const titreGroupe = (g) => (typeof g.titre === 'function' ? g.titre(nGroupe ? nGroupe.n(g.cle) : 0, nGroupe ? nGroupe.total(g.cle) : 0) : g.titre);
  // ── LE TABLEAU TIENT DANS SA LARGEUR (21 nov.) ────────────────────────────────────────────────────────────────────────
  // 1) Une colonne `replieVide` vide sur TOUTES les lignes (`vide(l)`, sinon sa valeur de tri absente) ne se montre pas : un
  //    « — » répété 82 fois ne dit rien (elle reste dans « Colonnes », où son choix la rend).
  // 2) Il manque de la place (le cadre défile, ou la colonne Article passe sous 260 px) : les colonnes `priorite` se replient,
  //    la plus petite priorité d'abord, jusqu'à ce que tout tienne — mesuré après le rendu, avant l'affichage ; recalculé quand
  //    la largeur change. Jamais de défilement horizontal. Une colonne forcée par lui ne se replie pas.
  const videPartout = (c) => !!c.replieVide && liste.length > 0 && liste.every((l) => { if (c.vide) return !!c.vide(l); const v = c.tri ? c.tri(l) : l[c.cle]; return v == null || v === ''; });
  const autoVides = new Set(colonnes.filter((c) => !forcees.has(c.cle) && videPartout(c)).map((c) => c.cle));
  const candidats = colonnes.filter((c) => !cachees.has(c.cle) && !autoVides.has(c.cle) && !forcees.has(c.cle) && Number.isFinite(c.priorite)).sort((a, b) => a.priorite - b.priorite).map((c) => c.cle);
  const [serrees, setSerrees] = React.useState(0);
  const serreesSet = new Set(candidats.slice(0, serrees));
  const colsVues = colonnes.filter((c) => !cachees.has(c.cle) && !autoVides.has(c.cle) && !serreesSet.has(c.cle));
  const refCadre = React.useRef(null);
  const [largeur, setLargeur] = React.useState(0);
  React.useEffect(() => {
    const r = refRacine.current; if (!r || typeof ResizeObserver === 'undefined') return undefined;
    const o = new ResizeObserver((e) => { const w = Math.round(e[0].contentRect.width); setLargeur((x) => (x === w ? x : w)); });
    o.observe(r); return () => o.disconnect();
  }, []);
  const cleCols = colonnes.map((c) => c.cle).join(',') + '|' + [...cachees].join(',') + '|' + [...forcees].join(',') + '|' + [...autoVides].join(',');
  React.useLayoutEffect(() => { setSerrees(0); }, [largeur, cleCols, vue]);
  React.useLayoutEffect(() => {
    if (!ordinateur || vue !== 'liste') return;
    const c = refCadre.current; if (!c) return;
    const th = c.querySelector('[data-tt-th="article"]');
    const trop = c.scrollWidth > c.clientWidth + 1 || (th && th.getBoundingClientRect().width < 260);
    if (trop && serrees < candidats.length) setSerrees(serrees + 1);
  });

  // La sélection : seulement ce que l'action choisie accepte (une ligne grisée ne se coche pas).
  const A = action ? actions.find((x) => x.cle === action) || null : null;
  const cochable = (l) => !l.grise && !l.nonCochable && (!A || !A.pour || A.pour(l));
  const choisies = liste.filter((l) => sel.has(l.cle) && cochable(l));
  const jugement = A ? (A.juger ? A.juger(choisies) : { ok: choisies.length > 0, raison: '' }) : { ok: false, raison: '' };
  const basculer = (l) => { if (!cochable(l)) return; if (pilote) { onCocher([l.cle], !sel.has(l.cle)); return; } setSel((s) => { const n = new Set(s); if (n.has(l.cle)) n.delete(l.cle); else n.add(l.cle); return n; }); };
  const cochables = affichees.filter(cochable);
  const toutCoche = cochables.length > 0 && cochables.every((l) => sel.has(l.cle));
  const toutBasculer = () => { if (pilote) { onCocher(cochables.filter((l) => sel.has(l.cle) === toutCoche).map((l) => l.cle), !toutCoche); return; } setSel(toutCoche ? new Set() : new Set(cochables.map((l) => l.cle))); };
  const quitter = () => { setSel(new Set()); setAction(null); };
  const lancer = () => { if (!A || !jugement.ok || !onAction) return; const c = choisies; quitter(); onAction(A.cle, c); };
  // (23 nov., revue UX #13) À l'ordinateur, la barre de sélection porte les actions COURANTES en boutons directs : un toucher lance
  // l'action sur ce qui est coché (la même règle `pour` / `juger`, le même `onAction`) ; les autres sous « ⋯ ». Plus de « Lancer ».
  const jugerPour = (X) => { const c = liste.filter((l) => sel.has(l.cle) && !l.grise && !l.nonCochable && (!X.pour || X.pour(l)));
    const j = X.juger ? X.juger(c) : { ok: c.length > 0, raison: '' }; return { c, ok: !!(j && j.ok) && c.length > 0, raison: (j && j.raison) || (c.length ? '' : (X.aucune || tr('tableau.actionAucune'))) }; };
  const lancerDirect = (X) => { const j = jugerPour(X); if (!j.ok || !onAction) return; quitter(); onAction(X.cle, j.c); };
  const choisirAction = (cle) => { setAction(cle); setMenu(''); const X = actions.find((x) => x.cle === cle); if (X && X.pour) setSel((s) => new Set([...s].filter((k) => { const l = liste.find((y) => y.cle === k); return l && !l.grise && X.pour(l); }))); };
  const ouvrir = (l) => { if (A && !ordinateur) { basculer(l); return; } if (onOuvrir) onOuvrir(l); };

  // ⌘K et « / » : la recherche DE CE TABLEAU, tant qu'il est montré (la coque garde la sienne ailleurs).
  React.useEffect(() => {
    const f = (e) => {
      const r = refRacine.current; if (!r || !r.getClientRects().length) return;
      const k = (e.key || '').toLowerCase();
      const cmd = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && k === 'k';
      const barre = k === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !saisie(e.target);
      if (!cmd && !barre) return;
      const c = r.querySelector('[data-tt-recherche] input'); if (!c) return;
      e.preventDefault(); e.stopPropagation(); c.focus(); try { c.select(); } catch (_) {}
    };
    window.addEventListener('keydown', f, true);
    return () => window.removeEventListener('keydown', f, true);
  }, []);
  // ↑ ↓ entre les lignes, Entrée ouvre, Espace coche, Échap vide la sélection.
  const surLigne = (e, l) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const tous = [...e.currentTarget.parentElement.querySelectorAll('[data-tt-ligne]')];
      const i = tous.indexOf(e.currentTarget); const j = Math.max(0, Math.min(tous.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (tous[j]) tous[j].focus();
    } else if (e.key === 'Enter') { e.preventDefault(); ouvrir(l); }
    else if (e.key === ' ') { e.preventDefault(); basculer(l); }
    else if (e.key === 'Escape' && sel.size) { e.preventDefault(); quitter(); }
  };
  const fermerMenu = React.useCallback(() => setMenu(''), []);
  const basculerStatut = (cle) => setStatutsSel((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  // Montrée ⇒ cachée ; repliée (vide partout, ou faute de place) ou cachée ⇒ montrée sur SON choix (`forcees`).
  const basculerColonne = (cle) => {
    const montree = colsVues.some((c) => c.cle === cle);
    setCachees((s) => { const n = new Set(s); if (montree) n.add(cle); else n.delete(cle); return n; });
    setForcees((s) => { const n = new Set(s); if (montree) n.delete(cle); else if (autoVides.has(cle) || serreesSet.has(cle)) n.add(cle); return n; });
  };
  const trier = (c) => setTri((t) => (t && t.cle === c.cle ? { cle: c.cle, sens: t.sens === 'desc' ? 'asc' : 'desc' } : { cle: c.cle, sens: c.num ? 'desc' : 'asc' }));
  const ic = (nom, t = 18) => (Icon ? <Icon name={nom} size={t}/> : null);
  const nStatuts = statutsSel.size;
  const statutDe = (l) => statuts.find((s) => s.cle === l.statut) || null;

  // ── la barre de titre (sous le titre que porte la coque) ───────────────────────────────────────────────────────────
  const tete = (
    <div className="n-tt-tete" data-tt-tete="">
      <span className="n-tt-compte" data-tt-compte={compte || ''}><span className="n-tt-compte-point" aria-hidden="true"/>{compte || tr('tableau.tousComptes')}</span>
      <span className="n-tt-espace"/>
      <span className="n-tt-maj" data-copie-vide="" data-tt-maj={majLe === undefined ? 'lecture' : majLe == null ? 'passu' : 'lu'}>{depuisMaj(majLe, maintenant)}</span>
      {onRafraichir ? <button type="button" data-n-famille="rond" className="n-tt-bouton n-tt-bouton-icone" data-tt-rafraichir="" aria-label={tr('tableau.rafraichir')} title={tr('tableau.rafraichir')}
        disabled={rafraichit} aria-busy={rafraichit ? 'true' : undefined} onClick={() => onRafraichir()}>{ic('sync', 18)}</button> : null}
    </div>
  );

  // ── le contenu des menus (le même à l'ordinateur et dans la feuille du téléphone) ─────────────────────────────────
  const corpsActions = (
    <div className="n-tt-pop-liste" role="menu" aria-label={tr('tableau.choisirAction')}>
      {actions.map((x) => { const n = x.pour ? liste.filter((l) => !l.grise && x.pour(l)).length : null;
        return <ChoixMenu key={x.cle} choisi={action === x.cle} libelle={x.libelle} indisponible={n === 0} raison={n === 0 ? (x.aucune || tr('tableau.actionAucune')) : ''}
          onClick={() => choisirAction(x.cle)} attrs={{ 'data-tt-action': x.cle }}/>; })}
      {action ? <ChoixMenu choisi={false} libelle={tr('tableau.actionAnnuler')} onClick={() => { setAction(null); setMenu(''); }} attrs={{ 'data-tt-action-annuler': '' }}/> : null}
    </div>
  );
  const corpsStatut = (
    <div className="n-tt-pop-liste" data-tt-statuts="">
      {statuts.map((s) => <CaseMenu key={s.cle} coche={statutsSel.has(s.cle)} onChange={() => basculerStatut(s.cle)} libelle={s.libelle} n={comptes[s.cle] || 0} attrs={{ 'data-tt-statut': s.cle }}/>)}
      {nStatuts ? <button type="button" className="n-tt-lien" data-tt-statuts-tous="" onClick={() => setStatutsSel(new Set())}>{tr('tableau.statutTous')}</button> : null}
    </div>
  );
  const corpsColonnes = (
    <div className="n-tt-pop-liste" data-tt-colonnes="">
      <CaseMenu coche indisponible raison={tr('tableau.colArticleToujours')} libelle={tr('tableau.colArticle')} attrs={{ 'data-tt-colonne': 'article' }}/>
      {colonnes.map((c) => <CaseMenu key={c.cle} coche={colsVues.some((x) => x.cle === c.cle)} onChange={() => basculerColonne(c.cle)}
        libelle={c.libelle + (autoVides.has(c.cle) ? ' · ' + tr('tableau.colVide') : serreesSet.has(c.cle) ? ' · ' + tr('tableau.colSerree') : '')} attrs={{ 'data-tt-colonne': c.cle, 'data-tt-colonne-repli': autoVides.has(c.cle) ? 'vide' : serreesSet.has(c.cle) ? 'place' : undefined }}/>)}
    </div>
  );
  const corpsFiltre = (f) => (
    <div className="n-tt-pop-liste" role="menu" aria-label={f.libelle}>
      {f.options.map((o) => <ChoixMenu key={o.cle} choisi={f.valeur === o.cle} libelle={o.libelle} icone={o.icone || null} n={o.n != null ? o.n : null} onClick={() => { f.onChange(o.cle); setMenu(''); }} attrs={{ 'data-tt-filtre-choix': f.cle + ':' + o.cle }}/>)}
    </div>
  );
  const libFiltre = (f) => { const o = f.options.find((x) => x.cle === f.valeur); return o && f.options[0] && o.cle !== f.options[0].cle ? o.libelle : f.libelle; };

  // Un bouton de la barre d'outils + son menu (à l'ordinateur) ; au téléphone, le menu est une feuille (plus bas).
  const outil = (cle, libelle, corps, { icone = null, droite = false, large = false, haut: versHaut = false, actif = false, attrs: a = null, chevron = true } = {}) => (
    <span className="n-tt-ancre" data-tt-ancre="">
      <button type="button" data-n-famille="second" className="n-tt-bouton" data-tt-ouvre={cle} data-tt-actif={actif ? '1' : undefined} aria-haspopup="true" aria-expanded={menu === cle ? 'true' : 'false'}
        onClick={() => setMenu((m) => (m === cle ? '' : cle))} {...(a || {})}>
        {icone}<span className="n-tt-bouton-libelle">{libelle}</span>{chevron ? <span className="n-tt-chevron" aria-hidden="true"/> : null}
      </button>
      {ordinateur ? <Deroulant ouvert={menu === cle} onFermer={fermerMenu} libelle={libelle} droite={droite} large={large} haut={versHaut}>{corps}</Deroulant> : null}
    </span>
  );

  const recherche = <ChampRecherche valeur={q} onChange={setQ} placeholder={placeholder || tr('tableau.chercher')} libelle={placeholder || tr('tableau.chercher')} attrs={{ 'data-tt-champ': '' }}/>;
  const outils = (
    <div className="n-tt-outils" data-tt-outils="">
      {actions.length && !(ordinateur && cases && !pilote) ? outil('action', A ? A.libelle : tr('tableau.choisirAction'), corpsActions, { actif: !!A, attrs: { 'data-tt-action-choisie': A ? A.cle : '' } }) : null}
      <div className="n-tt-recherche" data-tt-recherche="" ref={refChamp}>{recherche}</div>
      {statuts.length ? outil('statut', nStatuts ? tr('tableau.statutN', { n: nStatuts }) : tr('tableau.statut'), corpsStatut, { icone: ic('filter', 16), actif: nStatuts > 0 }) : null}
      {filtres.map((f) => outil('filtre:' + f.cle, libFiltre(f), corpsFiltre(f), { icone: (f.options.find((x) => x.cle === f.valeur) || {}).icone || null, actif: f.options[0] && f.valeur !== f.options[0].cle, attrs: { 'data-tt-filtre': f.cle, 'data-tt-filtre-valeur': f.valeur } }))}
      {outilsPlus ? <><span className="n-tt-espace"/>{outilsPlus}</> : null}
    </div>
  );
  const nombre = (
    <div className="n-tt-nombre" data-tt-nombre={Array.isArray(lignes) ? String(affichees.length) : undefined}>
      {/* (24 nov., lot visuel-annonces) pendant la lecture de la grille : la ligne est là (rien ne saute), le nombre pas encore su */}
      {Array.isArray(lignes) ? <span className="n-tt-nombre-texte">{unite(affichees.length)}</span> : <span className="n-os n-tt-nombre-os" aria-hidden="true"/>}
      <span className="n-tt-espace"/>
      {ordinateur && grille ? <span className="n-tt-vues" role="group" aria-label={tr('tableau.vue')}>
        <button type="button" data-n-famille="rond" className="n-tt-bouton n-tt-bouton-icone" aria-pressed={vue === 'liste'} aria-label={tr('tableau.vueListe')} title={tr('tableau.vueListe')} data-tt-vue="liste" onClick={() => setVue('liste')}>{ic('menu', 18)}</button>
        <button type="button" data-n-famille="rond" className="n-tt-bouton n-tt-bouton-icone" aria-pressed={vue === 'grille'} aria-label={tr('tableau.vueGrille')} title={tr('tableau.vueGrille')} data-tt-vue="grille" onClick={() => setVue('grille')}>{ic('grid', 18)}</button>
      </span> : null}
      {ordinateur && vue === 'liste' && colonnes.length ? outil('colonnes', tr('tableau.colonnes'), corpsColonnes, { icone: ic('gabarit', 16), droite: true }) : null}
    </div>
  );

  // ── le tableau (ordinateur) ───────────────────────────────────────────────────────────────────────────────────────
  // (24 nov., main-vert) `titreCourt: true` = une colonne SANS titre visible (les logos parlent d'eux-mêmes) : avant, `true`
  // se rendait vide et le bouton de tri n'avait AUCUN nom (axe button-name, colonne Site). Son nom est alors `libelle`.
  const titreVu = (c) => (c.titreCourt === true ? '' : (c.titreCourt || c.libelle));
  const enTete = (c) => {
    const actif = tri && tri.cle === c.cle;
    return (
      <th key={c.cle} scope="col" className="n-tt-th" data-tt-th={c.cle} data-tt-num={c.num ? '1' : undefined} aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : undefined}>
        {c.tri !== false ? <button type="button" data-n-famille="lien" className="n-tt-tri" data-tt-trier={c.cle} onClick={() => trier(c)} aria-label={titreVu(c) ? undefined : c.libelle} title={titreVu(c) ? undefined : c.libelle}>
          <span>{titreVu(c)}</span><span className="n-tt-tri-signe" data-tt-sens={actif ? tri.sens : ''} aria-hidden="true">{actif ? (tri.sens === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button> : <span className="n-tt-th-texte" aria-label={titreVu(c) ? undefined : c.libelle}>{titreVu(c)}</span>}
      </th>
    );
  };
  const celluleVal = (c, l) => { const v = c.rendu ? c.rendu(l) : l[c.cle]; return v == null || v === '' ? <span className="n-tt-vide-cellule">—</span> : v; };
  const menuDe = (l) => (menuLigne ? menuLigne(l) || [] : []);
  const tableau = (
    <div className="n-tt-cadre" data-tt-tableau="" ref={refCadre}>
      <table className="n-tt-table">
        <thead><tr>
          {cases ? <th scope="col" className="n-tt-th n-tt-th-case"><label className="n-tt-cible-case"><input type="checkbox" className="n-tt-coche" checked={toutCoche} aria-label={tr('tableau.toutCocher')} data-tt-tout="" onChange={toutBasculer} disabled={!cochables.length}/></label></th> : null}
          <th scope="col" className="n-tt-th n-tt-th-article" data-tt-th="article">{tr('tableau.colArticle')}</th>
          {colsVues.filter((c) => c.cle !== 'statut' && !c.apresStatut).map(enTete)}
          {colonnes.some((c) => c.cle === 'statut') && !cachees.has('statut') ? enTete(colonnes.find((c) => c.cle === 'statut')) : null}
          {colsVues.filter((c) => c.apresStatut).map(enTete)}
          {menuLigne ? <th scope="col" className="n-tt-th n-tt-th-menu"><span className="n-tt-sr">{tr('tableau.plusDActions')}</span></th> : null}
        </tr></thead>
        <tbody>
          {visibles.map((l, i) => {
            const g = groupe && !colTri ? groupe(l) : null;
            const gAvant = g && i > 0 ? groupe(visibles[i - 1]) : null;
            const inter = g && (!gAvant || gAvant.cle !== g.cle) ? <tr key={'g:' + g.cle} className="n-tt-intertitre" data-tt-groupe={g.cle}>
              <th scope="colgroup" colSpan={(cases ? 2 : 1) + colsVues.length + (menuLigne ? 1 : 0)} className="n-tt-intertitre-th">{titreGroupe(g)}</th></tr> : null;
            const coche = sel.has(l.cle); const grise = !cochable(l) && (A || l.grise); const m = menuDe(l); const st = statutDe(l);
            return (<React.Fragment key={l.cle}>{inter}
              <tr className="n-tt-tr" tabIndex={0} data-tt-ligne={l.cle} data-tt-statut-ligne={l.statut || ''} data-tt-coche={coche && !pilote ? '1' : undefined} data-tt-grise={grise ? '1' : undefined}
                aria-selected={coche ? 'true' : 'false'} aria-current={ligneChoisie && ligneChoisie === l.cle ? 'true' : undefined} data-tt-choisie={ligneChoisie && ligneChoisie === l.cle ? '1' : undefined} onClick={() => ouvrir(l)} onKeyDown={(e) => surLigne(e, l)} {...(l.attrs || {})}>
                {cases ? <td className="n-tt-td n-tt-td-case" onClick={(e) => e.stopPropagation()}><label className="n-tt-cible-case"><input type="checkbox" className="n-tt-coche" checked={coche} disabled={!cochable(l)} aria-label={tr('tableau.cocher', { titre: l.titre || '' })} onChange={() => basculer(l)}/></label></td> : null}
                <td className="n-tt-td n-tt-td-article" data-tt-col="article">
                  <span className="n-tt-article">
                    {l.icone ? <span className="n-tt-avatar" aria-hidden="true">{l.icone}</span> : <Vignette src={l.photo || ''} alt="" taille={48} image={l.image || null}/>}
                    <span className="n-tt-article-texte">
                      <span className="n-tt-article-titre" title={l.titre || ''}>{l.titre || tr('tableau.sansTitre')}</span>
                      {l.sous ? <span className="n-tt-article-sous" title={typeof l.sous === 'string' ? l.sous : undefined}>{l.sous}</span> : null}
                    </span>
                  </span>
                </td>
                {colsVues.filter((c) => c.cle !== 'statut' && !c.apresStatut).map((c) => <td key={c.cle} className="n-tt-td" data-tt-col={c.cle} data-tt-num={c.num ? '1' : undefined}>{celluleVal(c, l)}</td>)}
                {colonnes.some((c) => c.cle === 'statut') && !cachees.has('statut') ? <td className="n-tt-td" data-tt-col="statut"><Etiquette ton={st ? st.ton : 'neutre'}>{l.statutLibelle || (st ? st.libelle : '')}</Etiquette></td> : null}
                {colsVues.filter((c) => c.apresStatut).map((c) => <td key={c.cle} className="n-tt-td" data-tt-col={c.cle} data-tt-num={c.num ? '1' : undefined}>{celluleVal(c, l)}</td>)}
                {menuLigne ? <td className="n-tt-td n-tt-td-menu" onClick={(e) => e.stopPropagation()}>
                  {m.length ? <span className="n-tt-ancre" data-tt-ancre="">
                    <button type="button" data-n-famille="rond" className="n-tt-bouton n-tt-bouton-icone n-tt-plus" aria-label={tr('tableau.actionsDe', { titre: l.titre || '' })} aria-haspopup="true" aria-expanded={menu === 'ligne:' + l.cle ? 'true' : 'false'}
                      data-tt-plus={l.cle} onClick={() => setMenu((x) => (x === 'ligne:' + l.cle ? '' : 'ligne:' + l.cle))}>{ic('more', 18)}</button>
                    <Deroulant ouvert={menu === 'ligne:' + l.cle} onFermer={fermerMenu} libelle={tr('tableau.actionsDe', { titre: l.titre || '' })} droite>
                      <div className="n-tt-pop-liste" role="menu">{m.map((x) => <ChoixMenu key={x.cle} choisi={false} libelle={x.libelle} onClick={() => { setMenu(''); x.onClick(); }} attrs={{ 'data-tt-plus-choix': x.cle }}/>)}</div>
                    </Deroulant>
                  </span> : null}
                </td> : null}
              </tr></React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  // (21 nov., Annonces « Dressing ») `carteGrille(l, { coche, cochable, basculer, ouvrir, selection })` : l'écran dessine SA carte
  // dans la grille (mêmes lignes, même sélection, même ouverture) ; sans elle, la carte générique d'ici.
  // (24 nov., lot visuel-annonces) Une grille d'inventaire VIRTUALISÉE (src/natif/visuel/GrilleInventaire.jsx) quand l'écran donne la
  // hauteur de sa carte (`carteCorps`) : des centaines de cartes, seules celles près de l'écran sont montées, rien ne saute.
  const grilleVue = carteGrille ? (carteCorps ? (
    <GrilleInventaire items={affichees} cle={(l) => l.cle} corps={carteCorps} min={200} gap={16} className="n-tt-grille-ecran" attrs={{ 'data-tt-grille': '' }}
      rendu={(l, i, rv) => carteGrille(l, { coche: sel.has(l.cle), cochable: cochable(l), basculer, ouvrir, selection: !!A || sel.size > 0, revele: rv })}/>
  ) : (
    <div className="n-tt-grille n-tt-grille-ecran" data-tt-grille="">
      {visibles.map((l) => <React.Fragment key={l.cle}>{carteGrille(l, { coche: sel.has(l.cle), cochable: cochable(l), basculer, ouvrir, selection: !!A || sel.size > 0 })}</React.Fragment>)}
    </div>
  )) : (
    <div className="n-tt-grille" data-tt-grille="">
      {visibles.map((l) => { const coche = sel.has(l.cle); const st = statutDe(l); const prix = l.prixGrille;
        return (
          <div key={l.cle} className="n-tt-carte" role="button" tabIndex={0} data-tt-ligne={l.cle} data-tt-coche={coche ? '1' : undefined} onClick={() => ouvrir(l)} onKeyDown={(e) => surLigne(e, l)}>
            <span className="n-tt-carte-photo">{l.photo ? (l.image || photoParApp(l.photo) || <img src={l.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>) : <Vignette src="" alt="" taille={56}/>}</span>
            <label className="n-tt-carte-case" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="n-tt-coche" checked={coche} disabled={!cochable(l)} aria-label={tr('tableau.cocher', { titre: l.titre || '' })} onChange={() => basculer(l)}/></label>
            <span className="n-tt-carte-titre" title={l.titre || ''}>{l.titre || tr('tableau.sansTitre')}</span>
            <span className="n-tt-carte-pied">{prix ? <span className="n-tt-carte-prix">{prix}</span> : null}<Etiquette ton={st ? st.ton : 'neutre'}>{l.statutLibelle || (st ? st.libelle : '')}</Etiquette></span>
          </div>
        );
      })}
    </div>
  );
  // ── la liste du téléphone (rangées de 72, §4 NATIF) ──────────────────────────────────────────────────────────────
  const listeTel = (
    <Groupe attrs={{ 'data-tt-liste': '' }}>
      {visibles.map((l) => { const t = ligneTel ? ligneTel(l) : {}; const st = statutDe(l); const coche = sel.has(l.cle);
        return <Rangee key={l.cle} vignette={l.icone ? null : <Vignette src={l.photo || ''} alt="" image={l.image || null}/>} icone={l.icone || null} titre={l.titre || tr('tableau.sansTitre')} lignes={2}
          plaque={t.plaque || null} sousTitre={t.sousTitre != null ? t.sousTitre : (typeof l.sous === 'string' ? l.sous : '')} ton={t.ton || (st && st.ton === 'ambre' ? 'ambre' : 'neutre')}
          valeur={t.valeur != null ? t.valeur : null} valeurForte detailValeur={t.detailValeur != null ? t.detailValeur : (l.statutLibelle || (st ? st.libelle : ''))}
          fin={A ? (coche ? 'coche' : <span className="n-tt-rond" aria-hidden="true"/>) : (onOuvrir ? 'chevron' : null)} selectionnee={A ? coche : false}
          indisponible={!!(A && !cochable(l))} raison={A && !cochable(l) ? tr('tableau.pasPourCetteAction') : ''}
          onClick={onOuvrir || A ? () => ouvrir(l) : null} attrs={{ 'data-tt-ligne': l.cle, 'data-tt-statut-ligne': l.statut || '', 'data-tt-coche': coche ? '1' : undefined }}/>; })}
    </Groupe>
  );

  // ── la barre de sélection : « N sélectionnés · {Action} » (LE plein de l'écran tant qu'elle est là) ──────────────
  const nSel = choisies.length;
  // Les actions courantes : celles que l'écran marque `courante` (sinon les trois premières) ; les autres dans « ⋯ ».
  const marquees = actions.filter((x) => x.courante);
  const directes = (marquees.length ? marquees : actions.slice(0, 3)).slice(0, 3);
  const autres = actions.filter((x) => !directes.includes(x));
  const corpsAutres = (
    <div className="n-tt-pop-liste" role="menu" aria-label={tr('tableau.plusActions')}>
      {autres.map((X) => { const j = jugerPour(X);
        return <ChoixMenu key={X.cle} choisi={false} libelle={tr('tableau.lancer', { action: X.libelle, n: j.c.length })} indisponible={!j.ok} raison={j.ok ? '' : j.raison}
          onClick={() => { setMenu(''); lancerDirect(X); }} attrs={{ 'data-tt-action': X.cle, 'data-tt-action-directe': X.cle }}/>; })}
    </div>
  );
  const barreSel = !pilote && (nSel > 0 || A) ? (
    <div className="n-tt-barre-sel" data-tt-barre-sel={String(nSel)} role="region" aria-label={tr('tableau.selection', { n: nSel })}>
      <span className="n-tt-barre-texte" data-tt-n-sel={String(nSel)}>{tr('tableau.selection', { n: nSel })}</span>
      <button type="button" className="n-tt-lien" data-tt-deselect="" onClick={quitter}>{tr('tableau.deselect')}</button>
      <span className="n-tt-espace"/>
      {ordinateur && !A ? <>
        {directes.map((X, i) => { const j = jugerPour(X);
          return <Bouton key={X.cle} variante={i === 0 ? 'plein' : 'teinte'} indisponible={!j.ok} raison={j.ok ? '' : j.raison} onClick={() => lancerDirect(X)}
            attrs={{ 'data-tt-action-directe': X.cle, 'data-tt-lancer-n': String(j.c.length), ...(i === 0 ? { 'data-v2-principal': 'tableau' } : {}) }}>{tr('tableau.lancer', { action: X.libelle, n: j.c.length })}</Bouton>; })}
        {autres.length ? outil('action-bas', tr('tableau.plusActions'), corpsAutres, { haut: true, droite: true, attrs: { 'data-tt-action-bas': '' } }) : null}
      </> : ordinateur ? outil('action-bas', A.libelle, corpsActions, { haut: true, droite: true, actif: true, attrs: { 'data-tt-action-bas': A.cle } })
        : <Bouton variante="teinte" onClick={() => setMenu('action')} attrs={{ 'data-tt-action-bas': A ? A.cle : '' }}>{A ? A.libelle : tr('tableau.choisirAction')}</Bouton>}
      {ordinateur && !A ? null : <Bouton variante="plein" indisponible={!A || !jugement.ok} raison={!A ? tr('tableau.choisisAction') : !jugement.ok ? (jugement.raison || tr('tableau.cocheDAbord')) : ''} onClick={lancer}
        attrs={{ 'data-tt-lancer': A ? A.cle : '', 'data-tt-lancer-n': String(nSel), 'data-v2-principal': 'tableau' }}>{A ? tr('tableau.lancer', { action: A.libelle, n: nSel }) : tr('tableau.lancerSans', { n: nSel })}</Bouton>}
    </div>
  ) : null;

  // (24 nov., lot visuel-annonces) En grille d'inventaire, le squelette a la FORME des cartes (rien ne saute à l'arrivée).
  const corps = lignes === undefined ? (ordinateur && vue === 'grille' && carteGrille && carteCorps
      ? <GrilleInventaire items={undefined} attente={12} corps={carteCorps} min={200} gap={16} className="n-tt-grille-ecran" attrs={{ 'data-tt-grille': '' }}/>
      : <Attente forme="rangees" n={6} vignette={ordinateur ? 0 : 56} titre/>)
    : lignes === null ? <Vide icone={ic('cloudOff', 40)} phrase={pasSu || tr('tableau.pasSu')} action={actionPasSu}/>
    : !affichees.length ? <Vide icone={ic(q || nStatuts ? 'search' : iconeVide, 40)} phrase={q || nStatuts ? (videRecherche || tr('tableau.videRecherche')) : (vide || tr('tableau.vide'))}
        action={q || nStatuts ? <Bouton variante="texte" onClick={() => { setQ(''); setStatutsSel(new Set()); }} attrs={{ 'data-tt-effacer': '' }}>{tr('tableau.effacerFiltres')}</Bouton> : null}/>
    : !ordinateur ? listeTel : vue === 'grille' ? grilleVue : tableau;

  const feuilleTel = (cle, titreF, contenu) => <Feuille ouverte={!ordinateur && menu === cle} onFermer={fermerMenu} titre={titreF} attrs={{ 'data-tt-feuille': cle }}>{contenu}</Feuille>;
  return (
    <div className={cx('n-tt', ordinateur ? 'n-tt-ordi' : 'n-tt-tel')} ref={refRacine} data-tt={id} data-tt-vue={ordinateur ? vue : 'tel'} data-tt-etat={lignes === undefined ? 'lecture' : lignes === null ? 'passu' : 'lu'} {...(attrs || {})}>
      <Page titre={titre} plein={barreSel || plein}>
        {/* (20 nov., capture de Julien : « Tous les comptes » coupé, le segmenté caché sous l'en-tête, des rangées qui passent
            au-dessus) La tête du tableau est UN bloc collant, opaque, sous la barre de titre : rien ne la recouvre, rien ne passe dessus. */}
        <div className="n-tt-colle" data-tt-colle="">
          {tete}
          {avantOutils}
          {outils}
          {/* (21 nov.) À l'ordinateur, « N articles » · liste ⇄ grille · « Colonnes » font partie de la tête collante : rien ne passe dessous. */}
          {ordinateur && (Array.isArray(lignes) || (lignes === undefined && vue === 'grille' && carteGrille && carteCorps)) ? nombre : null}
        </div>
        {haut}
        {!ordinateur && Array.isArray(lignes) ? nombre : null}
        {corps}
        {affichees.length > max && !(ordinateur && vue === 'grille' && carteGrille && carteCorps) ? <div className="n-tt-plus-bas"><Bouton variante="texte" onClick={() => setMax((m) => m + PAR_PAGE)} attrs={{ 'data-tt-voir-plus': '' }}>{tr('tableau.voirPlus', { n: Math.min(PAR_PAGE, affichees.length - max) })}</Bouton></div> : null}
        {pied ? <p className="n-tt-pied" data-tt-pied="">{pied}</p> : null}
        {enfants}
      </Page>
      {feuilleTel('action', tr('tableau.choisirAction'), corpsActions)}
      {feuilleTel('statut', tr('tableau.statut'), corpsStatut)}
      {filtres.map((f) => <React.Fragment key={f.cle}>{feuilleTel('filtre:' + f.cle, f.libelle, corpsFiltre(f))}</React.Fragment>)}
    </div>
  );
}

export default TableauTravail;
