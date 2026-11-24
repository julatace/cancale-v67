// ── src/natif/Page.jsx — la page : grand titre, recherche, contenu, plein collé ──────────
// TROIS composants.
//
// 1) <Page> — un écran. Grand titre 34/41 qui se réduit en 17/600 centré dans la barre au défilement ;
//    la recherche est sous le grand titre et part avec lui ; le bouton plein reste collé en bas
//    (au-dessus de la barre d'onglets).
//    Props :
//      titre      le nom de l'écran (« Ventes »)
//      actions    nœuds à droite de la barre de titre : DEUX <BoutonIcone> au plus
//      recherche  <ChampRecherche …/>
//      plein      LE <Bouton variante="plein">…</Bouton> de l'écran (un seul)
//      className, attrs
//    ⚠️ DANS LA COQUE, c'est la coque qui porte le grand titre et la barre (elle reçoit `titre`) :
//    une <Page> rendue dedans n'ajoute alors que sa recherche, son contenu et son plein — tu peux
//    donc écrire <Page titre="Ventes" plein={…}> dans ton écran sans te demander qui dessine la barre.
//    Clavier : ↑ ↓ passent d'une rangée à l'autre dans la page (Entrée ouvre, c'est le bouton).
//    Exemple :
//      <Page titre="Ventes" plein={<Bouton variante="plein" onClick={imprimer}>Imprimer 3 bordereaux</Bouton>}>
//        <Segmente …/>
//        <Groupe titre="À envoyer">…</Groupe>
//      </Page>
//
// 2) <PagePoussee> — une fiche, un atelier : une page qui arrive de la droite et couvre l'écran.
//    Retour « ‹ » en haut à gauche, balayage depuis le bord gauche, geste « retour » du téléphone, Échap.
//    À l'ordinateur, dans la coque à trois volets, elle s'ouvre toute seule dans le volet de détail.
//    Props : ouverte · titre · onRetour · libelleRetour (« Ventes ») · actions · plein · className · attrs
//    Exemple :
//      <PagePoussee ouverte={!!fiche} titre="N° 124" libelleRetour="Annonces" onRetour={() => setFiche(null)}>
//        <Groupe>…</Groupe>
//      </PagePoussee>
//
// 3) <ChampRecherche> — le champ de recherche (44 de haut, 17 px : l'iPhone ne zoome pas).
//    Props : valeur · onChange(texte) · placeholder · onEnvoyer(texte) · onScanner (⇒ le bouton scanner DANS le champ)
//            · libelle (nom pour le lecteur d'écran) · onOuvrir (⇒ le champ est une porte : le toucher ouvre la
//            recherche de l'écran, il ne saisit rien lui-même) · attrs (posés sur <input>)
//    Exemple :
//      <ChampRecherche valeur={q} onChange={setQ} placeholder="N°, titre, acheteur" onScanner={ouvrirScanner}/>
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { FermeAuRetourUi, retourDisponible } from '../ui/retour.jsx';
import { cx, mouvementReduit, portailNatif, useDernier } from './outils.js';
import { Glyphe } from './icones.jsx';

// Ce que la coque dit aux pages qu'elle contient : { titreRendu, voletDetail }.
export const ContexteCoque = React.createContext(null);

// (24 nov., vitesse) LA LETTRE D'ABORD, LA LISTE APRÈS. Mesuré (banc vitesse-iphone, 390 ×4, volume de Julien) : chaque
// lettre tapée dans la recherche d'Annonces re-rendait tout l'écran AVANT d'afficher la lettre (124 à 750 ms par lettre).
// Le champ garde sa propre valeur (la lettre s'affiche à l'image suivante) ; l'écran reçoit la valeur APRÈS cette image
// (rAF puis tâche, 100 ms au plus sans image) — des lettres tapées plus vite que l'écran ne se rend sont envoyées ensemble
// (la dernière valeur seulement). Entrée, l'effacement et la sortie du champ envoient tout de suite. Ce que l'écran reçoit
// est inchangé (la même valeur, dans le même ordre) ; une valeur posée par l'écran (effacée, coupée) remplace celle du champ.
// Pas une transition React : une transition retenue ailleurs retiendrait la recherche (latence, 22 nov.).
function useValeurDiffere(valeur, onChange) {
  const [locale, setLocale] = React.useState(valeur);
  const recue = React.useRef(valeur);   // la dernière valeur que l'écran connaît (reçue de lui, ou envoyée à lui)
  if (valeur !== recue.current) { recue.current = valeur; if (locale !== valeur) setLocale(valeur); }
  const surChange = useDernier(onChange);
  const plan = React.useRef({ image: 0, tache: 0, filet: 0, v: null });
  const annuler = React.useCallback(() => { const p = plan.current; if (p.image) cancelAnimationFrame(p.image); if (p.tache) clearTimeout(p.tache); if (p.filet) clearTimeout(p.filet); p.image = p.tache = p.filet = 0; }, []);
  const envoyer = React.useCallback((v) => { annuler(); plan.current.v = null; recue.current = v; if (surChange.current) surChange.current(v); }, [annuler, surChange]);
  const vider = React.useCallback(() => { const v = plan.current.v; if (v != null) envoyer(v); }, [envoyer]);
  const planifier = React.useCallback((v) => {
    const p = plan.current; p.v = v;
    if (p.image || p.tache || p.filet) return;
    const ensuite = () => { if (p.image) cancelAnimationFrame(p.image); if (p.filet) clearTimeout(p.filet); p.image = p.filet = 0; if (!p.tache) p.tache = setTimeout(() => { p.tache = 0; vider(); }, 0); };
    p.image = requestAnimationFrame(ensuite);
    p.filet = setTimeout(ensuite, 100);
  }, [vider]);
  React.useEffect(() => () => { vider(); annuler(); }, [vider, annuler]);
  const changer = (v) => { setLocale(v); planifier(v); };
  return { locale, changer, envoyer, vider };
}

export function ChampRecherche({ valeur = '', onChange, placeholder = '', onEnvoyer = null, onScanner = null, libelle = '', onOuvrir = null, className = '', attrs = null }) {
  const ref = React.useRef(null);
  const nom = libelle || placeholder || tr('natif.recherche.nom');
  const d = useValeurDiffere(valeur, onChange);
  const vue = onOuvrir ? valeur : d.locale;
  return (
    <form
      className={cx('n-recherche', className)}
      role="search"
      data-n-recherche=""
      onSubmit={(e) => { e.preventDefault(); d.vider(); if (onEnvoyer) onEnvoyer(vue); if (ref.current) ref.current.blur(); }}
    >
      <Glyphe nom="search" taille={18} className="n-recherche-loupe"/>
      <input
        ref={ref}
        className="n-recherche-champ"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={vue}
        placeholder={placeholder || tr('natif.recherche.nom')}
        aria-label={nom}
        readOnly={onOuvrir ? true : undefined}
        onClick={onOuvrir || undefined}
        onKeyDown={onOuvrir ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOuvrir(e); } } : undefined}
        onChange={(e) => { if (onOuvrir) { if (onChange) onChange(e.target.value); } else d.changer(e.target.value); }}
        onBlur={onOuvrir ? undefined : d.vider}
        {...(attrs || {})}
      />
      {vue && !onOuvrir ? (
        <button type="button" className="n-recherche-bouton" aria-label={tr('natif.recherche.effacer')} onClick={() => { d.changer(''); d.envoyer(''); if (ref.current) ref.current.focus(); }}>
          <span className="n-recherche-efface" aria-hidden="true"><Glyphe nom="close" taille={12}/></span>
        </button>
      ) : null}
      {onScanner ? (
        <button type="button" className="n-recherche-bouton" aria-label={tr('natif.recherche.scanner')} title={tr('natif.recherche.scanner')} onClick={onScanner}>
          <Glyphe nom="scan" taille={20}/>
        </button>
      ) : null}
    </form>
  );
}

// ↑ ↓ : d'une rangée à la suivante, dans le conteneur.
function fleches(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const ici = e.target && e.target.closest ? e.target.closest('.n-rangee-corps') : null;
  if (!ici || ici.tagName === 'LABEL') return;
  const toutes = [...e.currentTarget.querySelectorAll('button.n-rangee-corps, a.n-rangee-corps, .n-rangee-corps[tabindex="0"]')];
  const k = toutes.indexOf(ici); if (k < 0) return;
  const suivant = toutes[k + (e.key === 'ArrowDown' ? 1 : -1)];
  if (suivant) { e.preventDefault(); suivant.focus(); }
}

// La barre se « réduit » quand le grand titre est passé dessous (voir le choix du titre jugé ci-dessous),
// et l'attribut est posé sur la barre seule (rien d'autre ne recalcule son style).
function useTitreReduit(refBarre, refTitre) {
  React.useEffect(() => {
    if (!refBarre.current) return undefined;
    // (19 nov., intégration) Le titre JUGÉ est celui qu'on VOIT : le grand titre de la coque, ou — quand l'écran pose le sien
    // (Page natif d'Annonces, de Ventes : celui de la coque est alors caché) — le premier grand titre visible de l'écran.
    // Un titre caché ne passe jamais « dessous » : sans ce choix, la barre se croyait réduite en haut (petit + grand titre).
    // Lu au défilement (passif, une lecture par image), à la taille, et quand l'écran change.
    // ⚠️ (20 nov., lot argent-natif) Les éléments sont relus À CHAQUE FOIS (`ref.current`), jamais gardés du montage :
    // la tête de la coque naît sur Aujourd'hui (grand titre) puis l'écran change (le repère prend sa place) — l'ancien
    // titre, détaché, n'était plus « vu », la barre ne se réduisait plus jamais et ses icônes flottaient SUR le contenu
    // (captures de Julien, 20 nov., Argent).
    // `data-n-fond` : la barre prend son fond (flou + filet) dès que du contenu passe dessous (l'écran a défilé), comme
    // iOS ; `data-n-reduit` : le petit titre centré, une fois le grand titre passé.
    let image = 0;
    const vu = (e) => !!e && e.isConnected && e.getClientRects().length > 0;
    const verifier = () => {
      image = 0;
      const barre = refBarre.current, titre = refTitre.current;
      if (!barre || !barre.isConnected) return;
      const cible = vu(titre) ? titre : [...document.querySelectorAll('.vrm-main .n-grand-titre')].find(vu) || null;
      const bas = barre.getBoundingClientRect().bottom;
      // Un écran d'avant (pas de grand titre natif : un repère) pose son propre titre dessous : le petit titre attend ~48 px de défilement.
      const marge = cible && !cible.classList.contains('n-grand-titre') ? 48 : 0;
      const reduit = !!cible && cible.getBoundingClientRect().bottom <= bas - marge;
      const defileur = barre.closest('.n-coque-ecran, .n-poussee, .n-feuille-corps');
      // (20 nov.) À l'ordinateur, c'est parfois un ancêtre plus haut qui défile (`.vrm-main`) : le premier ancêtre défilé compte.
      let haut = defileur && defileur.scrollHeight > defileur.clientHeight + 1 ? defileur.scrollTop : (window.scrollY || 0);
      if (!haut) { for (let e = barre.parentElement; e && e !== document.body; e = e.parentElement) if (e.scrollTop > 0) { haut = e.scrollTop; break; } }
      const fond = reduit || haut > 0 || (!!cible && cible.getBoundingClientRect().top < bas - 1);
      // (22 nov., latence-totale) Seulement quand l'état CHANGE : reposer le même attribut toutes les 1,5 s réveillait les
      // observateurs de mutations de la page (copie d'écran, drapeaux) pour rien.
      if (reduit !== barre.hasAttribute('data-n-reduit')) { if (reduit) barre.setAttribute('data-n-reduit', ''); else barre.removeAttribute('data-n-reduit'); }
      if (fond !== barre.hasAttribute('data-n-fond')) { if (fond) barre.setAttribute('data-n-fond', ''); else barre.removeAttribute('data-n-fond'); }
    };
    const demander = () => { if (!image) image = requestAnimationFrame(verifier); };
    demander();
    document.addEventListener('scroll', demander, { passive: true, capture: true });
    window.addEventListener('resize', demander, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(demander) : null;
    if (ro) ro.observe(refBarre.current);
    const t = setInterval(demander, 1500);   // l'écran change d'onglet sans défiler : relu, sans coût (une lecture)
    return () => { if (image) cancelAnimationFrame(image); clearInterval(t); document.removeEventListener('scroll', demander, true); window.removeEventListener('resize', demander); if (ro) ro.disconnect(); };
  }, [refBarre, refTitre]);
}

// La TÊTE d'une page, seule : la barre collée, le grand titre (ou rien : `grandTitre={false}` — la barre montre alors le
// titre dès qu'on défile), la recherche. Elle n'enveloppe pas le contenu : c'est ce que la coque pose au-dessus d'un écran
// d'AVANT, qui garde son propre titre. `gauche` : nœuds à gauche de la barre (rare).
//   <TetePage titre="Ventes" grandTitre={false} actions={…} recherche={<ChampRecherche onOuvrir={ouvrir}/>}/>
export function TetePage({ titre = '', grandTitre = true, gauche = null, actions = null, recherche = null, attrs = null }) {
  const refBarre = React.useRef(null), refTitre = React.useRef(null);
  useTitreReduit(refBarre, refTitre);
  return (
    <>
      <header className="n-barre-titre" ref={refBarre} data-n-tete="" {...(attrs || {})}>
        <div className="n-barre-gauche">{gauche}</div>
        <div className="n-barre-centre" aria-hidden={grandTitre ? 'true' : undefined}>{titre}</div>
        <div className="n-barre-droite">{actions}</div>
      </header>
      {grandTitre && titre ? <h1 className="n-grand-titre" ref={refTitre}>{titre}</h1> : <div className="n-tete-repere" ref={refTitre} aria-hidden="true"/>}
      {recherche ? <div className="n-page-recherche">{recherche}</div> : null}
    </>
  );
}

export function Page({ titre = '', actions = null, recherche = null, plein = null, className = '', attrs = null, children }) {
  const coque = React.useContext(ContexteCoque);
  const refBarre = React.useRef(null), refTitre = React.useRef(null);
  const interieure = !!(coque && coque.titreRendu);
  useTitreReduit(refBarre, refTitre);
  if (interieure) {
    return (
      <div className={cx('n-page-contenu', className)} onKeyDown={fleches} data-n-avec-plein={plein ? '' : undefined} {...(attrs || {})}>
        {recherche ? <div className="n-page-recherche">{recherche}</div> : null}
        {children}
        {plein ? <div className="n-page-plein" data-n-plein="">{plein}</div> : null}
      </div>
    );
  }
  return (
    <div className={cx('n-page', className)} {...(attrs || {})}>
      <header className="n-barre-titre" ref={refBarre}>
        <div className="n-barre-gauche"/>
        <div className="n-barre-centre" aria-hidden="true">{titre}</div>
        <div className="n-barre-droite">{actions != null ? actions : (coque ? coque.actions : null)}</div>
      </header>
      {titre ? <h1 className="n-grand-titre" ref={refTitre}>{titre}</h1> : null}
      {recherche ? <div className="n-page-recherche">{recherche}</div> : null}
      <ContexteCoque.Provider value={coque ? { ...coque, titreRendu: true } : { titreRendu: true, voletDetail: null }}>
        <div className="n-page-contenu" onKeyDown={fleches}>{children}</div>
      </ContexteCoque.Provider>
      {plein ? <div className="n-page-plein" data-n-plein="">{plein}</div> : null}
    </div>
  );
}

const DUREE_SORTIE = 300;
const BORD = 24;   // px depuis le bord gauche : la zone du balayage « retour »

export function PagePoussee({ ouverte = true, titre = '', onRetour, libelleRetour = '', actions = null, plein = null, className = '', attrs = null, children }) {
  const coque = React.useContext(ContexteCoque);
  const volet = coque && coque.voletDetail ? coque.voletDetail : null;
  const ref = React.useRef(null), geste = React.useRef(null), avant = React.useRef(null);
  // (19 nov., intégration) Un détail né dans le volet de droite n'en sort JAMAIS en page plein écran : quand son écran est
  // quitté (écran gardé, monté mais caché : sa page ne se re-rend pas, seul ce détail lit le contexte), la coque retire le volet — il se tait (vu : le volet de Ventes couvrait Achats
  // et la barre latérale à l'ordinateur). Il revient avec son volet.
  const neVolet = React.useRef(false);
  if (volet) neVolet.current = true;
  const refRetour = useDernier(onRetour);
  const [monte, setMonte] = React.useState(ouverte);
  const [etat, setEtat] = React.useState(ouverte ? 'entree' : 'sortie');
  const retour = React.useCallback(() => { const f = refRetour.current; if (f) f(); }, [refRetour]);

  React.useEffect(() => {
    if (ouverte) {
      setMonte(true); setEtat('entree');
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setEtat('ouverte')));
      return () => cancelAnimationFrame(r);
    }
    setEtat('sortie');
    const t = setTimeout(() => setMonte(false), volet || mouvementReduit() ? 0 : DUREE_SORTIE);
    return () => clearTimeout(t);
  }, [ouverte, volet]);

  // En page qui couvre l'écran : le focus y entre et revient. Dans le volet de détail : le focus reste dans la liste (↑ ↓).
  React.useEffect(() => {
    if (!monte || !ouverte || volet) return undefined;
    avant.current = document.activeElement;
    if (ref.current) { try { ref.current.focus({ preventScroll: true }); } catch (_) {} }
    return () => {
      const a = avant.current; avant.current = null;
      if (a && a.isConnected && typeof a.focus === 'function') { try { a.focus({ preventScroll: true }); } catch (_) {} }
    };
  }, [monte, ouverte, volet]);

  const poser = (x, anime) => {
    const el = ref.current; if (!el) return;
    el.style.transition = anime ? '' : 'none';
    el.style.transform = x ? `translate3d(${Math.round(x)}px,0,0)` : '';
  };
  const bas = (e) => {
    if (volet || e.pointerType === 'mouse' || e.clientX > BORD) return;
    geste.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, actif: false, pts: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const bouge = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.actif) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) || dx < 0) { geste.current = null; return; }
      g.actif = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
    g.x = Math.max(0, dx);
    g.pts.push({ x: e.clientX, t: e.timeStamp }); if (g.pts.length > 5) g.pts.shift();
    poser(g.x, false);
  };
  const haut = (e) => {
    const g = geste.current; if (!g || g.id !== e.pointerId) return;
    geste.current = null;
    if (!g.actif) return;
    const a = g.pts[0], b = g.pts[g.pts.length - 1];
    const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    const l = ref.current ? ref.current.offsetWidth : 1;
    poser(0, true);
    if (e.type !== 'pointercancel' && (v > 0.5 || g.x > l * 0.35)) retour();
  };

  if (!monte) return null;
  if (!volet && neVolet.current && typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches) return null;
  const cible = volet || portailNatif(); if (!cible) return null;
  return createPortal(
    <div
      ref={ref}
      className={cx('n-poussee', className)}
      data-n-etat={etat}
      data-n-volet={volet ? '1' : undefined}
      data-n-large={!volet && coque && coque.ordinateur ? '1' : undefined}
      data-n-poussee=""
      role={volet ? 'region' : 'dialog'}
      aria-modal={volet ? undefined : 'true'}
      aria-label={titre || undefined}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape' && (volet || !retourDisponible())) { e.stopPropagation(); retour(); } }}
      onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}
      {...(attrs || {})}
    >
      {ouverte && !volet ? <FermeAuRetourUi fermer={retour}/> : null}
      <header className="n-barre-titre" data-n-reduit="">
        <div className="n-barre-gauche">
          <button type="button" className="n-barre-retour" onClick={retour} aria-label={libelleRetour ? tr('natif.retourVers', { ecran: libelleRetour }) : tr('natif.retour')}>
            <Glyphe nom="chevron" taille={22} className="n-barre-retour-fleche"/>
            <span className="n-barre-retour-libelle">{libelleRetour || tr('natif.retour')}</span>
          </button>
        </div>
        <h1 className="n-barre-centre">{titre}</h1>
        <div className="n-barre-droite">{actions}</div>
      </header>
      <ContexteCoque.Provider value={{ titreRendu: true, voletDetail: volet }}>
        <div className="n-page-contenu" onKeyDown={fleches}>{children}</div>
      </ContexteCoque.Provider>
      {plein ? <div className="n-page-plein" data-n-plein="">{plein}</div> : null}
    </div>,
    cible,
  );
}

export default Page;
