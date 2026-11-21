// ── src/natif/Coque.jsx — LA coque de l'app (contrat NATIF.md §2) ────────────────────────
// Téléphone : barre de titre à grand titre qui se réduit · recherche sous le titre, qui part au défilement ·
//   à droite DEUX icônes (Messages avec pastille, avatar → « Plus ») · barre d'onglets fixe en bas.
// Ordinateur (≥ 1024) : barre latérale 240 (tous les écrans : onglets + « Plus ») · la liste · le détail.
//   volets="deux"  (défaut) : barre latérale + l'écran sur tout le reste, la PAGE défile (les écrans d'avant).
//   volets="trois" : barre latérale + liste 380–520 + détail borné à 760 ; chaque volet défile seul.
//                    Une <PagePoussee> rendue par l'écran s'ouvre TOUTE SEULE dans le volet de détail ;
//                    sans rien d'ouvert, `detailVide` (un <Vide>) est dessiné.
// Props :
//   onglets     [{ cle, libelle, icone, iconeLaterale, pastille, libellePastille }]  — 5 (icone 24, iconeLaterale 20)
//   plus        [{ titre, entrees: [{ cle, libelle, icone, pastille, libellePastille, valeur, onChoisir }] }]
//               les écrans hors onglets (Stock, Messages, E-mails, Tout va bien ?, Paramètres, Communauté)
//   actif       la `cle` de l'écran courant (un onglet ou une entrée de « Plus »)
//   onChoisir   (cle) => …
//   titre       le grand titre de l'écran courant. Absent ⇒ l'écran rend sa propre <Page>.
//   recherche   <ChampRecherche …/> — UNE recherche, sous le grand titre (⌘K ou « / » y vont)
//   messages    { n, libelle, icone, onOuvrir } — l'icône Messages de la barre de titre (téléphone)
//   compte      { initiales, nom, sousTitre, photo } — l'avatar ; le toucher ouvre « Plus »
//   actions     nœuds en plus dans la barre de titre, AVANT Messages (rare : deux icônes au plus au téléphone)
//   bandeaux    nœud : panne de base, hors ligne, mise à jour, mode exemple — en tête de l'écran, dans le flux
//   marque      nœud : la tête de la barre latérale (le logo, le nom)
//   plusTete / plusPied   nœuds en haut / en bas de la feuille « Plus » (compte, aide, déconnexion…)
//   plusOuvert / onPlus   (optionnels) pour piloter la feuille « Plus » de l'extérieur
//   volets      'deux' | 'trois'      · detail (nœud posé dans le volet de détail) · detailVide
//   className, attrs
// Changer d'onglet ne pose AUCUN attribut sur la coque ni au-dessus : seuls l'onglet quitté et l'onglet
// choisi changent (`aria-current`). Rien n'invalide le style du document.
// Exemple :
//   <Coque onglets={ONGLETS} plus={PLUS} actif={tab} onChoisir={setTab} titre={titreDe(tab)}
//          recherche={<ChampRecherche onOuvrir={ouvrirLoupe} onScanner={scanner}/>}
//          messages={{ n: nonLus, libelle: 'Messages', icone: <Icon name="chat" size={24}/>, onOuvrir: () => setTab('messages') }}
//          compte={{ initiales: 'JU', nom: 'Julien' }}>
//     {ecran}
//   </Coque>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';
import { BoutonIcone } from './Bouton.jsx';
import { BarreOnglets } from './BarreOnglets.jsx';
import { BarreLaterale } from './BarreLaterale.jsx';
import { Feuille } from './Feuille.jsx';
import { Groupe } from './Groupe.jsx';
import { Rangee } from './Rangee.jsx';
import { Pastille } from './Pastille.jsx';
import { Page, ContexteCoque } from './Page.jsx';

export const LARGEUR_ORDINATEUR = 1024;
const REQUETE = `(min-width: ${LARGEUR_ORDINATEUR}px)`;
const abonner = (fn) => {
  try { const m = window.matchMedia(REQUETE); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); } catch (_) { return () => {}; }
};
const lire = () => { try { return window.matchMedia(REQUETE).matches; } catch (_) { return false; } };
// Vrai à l'ordinateur (≥ 1024 px). Un écran peut s'en servir pour choisir « deux » ou « trois » volets.
export function useOrdinateur() { return React.useSyncExternalStore(abonner, lire, () => false); }

const saisieEnCours = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

export function Avatar({ compte = null, taille = 30 }) {
  const c = compte || {};
  return (
    <span className="n-avatar" data-n-taille={taille} aria-hidden="true">
      {c.photo ? <img className="n-avatar-photo" src={c.photo} alt="" width={taille} height={taille} draggable="false"/> : <span className="n-avatar-initiales">{String(c.initiales || '').slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}

// ── LES PIÈCES DE LA COQUE, pour une app qui garde sa propre structure (src/App.jsx : `<main>` qui défile, ses hôtes) ──
// <CoqueRacine> : la racine (classes `n-coque`, la mise en page téléphone / ordinateur).
//   defile  'page' (défaut : le document défile, barre d'onglets fixe) | 'ecran' (la racine a la hauteur de l'écran,
//           <CoqueEcran> défile, la barre d'onglets est SOUS lui dans le flux — jamais au milieu de l'écran sur iPhone)
//   volets  'deux' | 'trois' · className · attrs
// <CoqueEcran> : le <main> de l'écran (className, attrs : id, data-*, style, ref).
// <ActionsCoque> : les DEUX icônes de la barre de titre (Messages avec pastille, avatar → « Plus »).
// <FeuillePlus> : la feuille « Plus » (groupes d'entrées, `tete`, `pied`).
export function CoqueRacine({ defile = 'page', volets = 'deux', className = '', attrs = null, children }) {
  const ordinateur = useOrdinateur();
  return (
    <div className={cx('n-coque', className)} data-n-coque="" data-n-defile={defile} data-n-volets={ordinateur ? volets : undefined} {...(attrs || {})}>
      {children}
    </div>
  );
}
export function CoqueEcran({ className = '', attrs = null, children }) {
  return <main className={cx('n-coque-ecran', className)} data-n-coque-ecran="" {...(attrs || {})}>{children}</main>;
}
export function ActionsCoque({ messages = null, compte = null, avatar = null, plusOuvert = false, onPlus, pointPlus = false }) {
  return (
    <>
      {messages ? (
        <BoutonIcone
          libelle={messages.n && messages.libellePastille ? messages.libellePastille : (messages.libelle || tr('natif.messages'))}
          icone={messages.icone}
          onClick={messages.onOuvrir}
          attrs={{ 'data-n-coque-messages': '' }}
          pastille={messages.n ? (messages.n === true ? <span className="n-coin-point" aria-hidden="true"/> : <Pastille ton="ambre-plein" className="n-coin-pastille">{messages.n}</Pastille>) : null}
        />
      ) : null}
      <BoutonIcone
        libelle={tr('natif.plus.ouvrir')}
        icone={avatar || <Avatar compte={compte}/>}
        onClick={onPlus}
        attrs={{ 'data-n-coque-plus': '', 'aria-haspopup': 'dialog', 'aria-expanded': plusOuvert ? 'true' : 'false' }}
        pastille={pointPlus ? <span className="n-coin-point" aria-hidden="true"/> : null}
      />
    </>
  );
}
export function FeuillePlus({ ouverte = false, onFermer, groupes = [], actif = '', onChoisir, tete = null, pied = null }) {
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('natif.plus.titre')} detente="pleine" attrs={{ 'data-n-feuille-plus': '' }}>
      {tete}
      {groupes.map((g, i) => (
        <Groupe key={g.titre || i} titre={g.titre || ''}>
          {g.entrees.map((o) => (
            <Rangee
              key={o.cle}
              titre={o.libelle}
              icone={o.iconeLaterale || o.icone}
              valeur={o.valeur}
              pastille={o.pastille ? (o.pastille === true ? <Pastille ton="ambre">{tr('natif.plus.nouveau')}</Pastille> : <Pastille ton="ambre-plein" libelle={o.libellePastille || ''}>{o.pastille}</Pastille>) : null}
              fin={o.interrupteur ? null : (o.cle === actif ? 'coche' : 'chevron')}
              interrupteur={o.interrupteur || null}
              onClick={o.interrupteur ? null : () => { if (onFermer) onFermer(); if (o.onChoisir) o.onChoisir(o.cle); else if (onChoisir) onChoisir(o.cle); }}
              attrs={{ 'data-n-plus-entree': o.cle, ...(o.attrs || {}) }}
            />
          ))}
        </Groupe>
      ))}
      {pied}
    </Feuille>
  );
}

export function Coque({ onglets = [], plus = [], actif = '', onChoisir, titre = '', recherche = null, messages = null, compte = null, actions = null,
  bandeaux = null, marque = null, plusTete = null, plusPied = null, plusOuvert, onPlus = null, volets = 'deux', detail = null, detailVide = null,
  className = '', attrs = null, children }) {
  const ordinateur = useOrdinateur();
  const ref = React.useRef(null);
  const [plusLocal, setPlusLocal] = React.useState(false);
  const [volet, setVolet] = React.useState(null);
  const ouvertPlus = plusOuvert != null ? !!plusOuvert : plusLocal;
  const poserPlus = (v) => { if (onPlus) onPlus(v); if (plusOuvert == null) setPlusLocal(v); };
  const trois = ordinateur && volets === 'trois';

  // ⌘K / Ctrl+K / « / » : la recherche.
  React.useEffect(() => {
    const touche = (e) => {
      const k = (e.key || '').toLowerCase();
      const cmd = (e.metaKey || e.ctrlKey) && k === 'k';
      const barre = k === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !saisieEnCours(e.target);
      if (!cmd && !barre) return;
      const champ = ref.current && ref.current.querySelector('[data-n-recherche] input');
      if (!champ) return;
      e.preventDefault();
      if (champ.readOnly) champ.click(); else champ.focus();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  const choisir = (cle) => { if (onChoisir) onChoisir(cle); };
  const choisirPlus = (o) => { poserPlus(false); if (o.onChoisir) o.onChoisir(o.cle); else choisir(o.cle); };
  const aPastillePlus = plus.some((g) => g.entrees.some((o) => !!o.pastille));

  const actionsBarre = ordinateur ? actions : (
    <>
      {actions}
      {messages ? (
        <BoutonIcone
          libelle={messages.n && messages.libellePastille ? messages.libellePastille : (messages.libelle || tr('natif.messages'))}
          icone={messages.icone}
          onClick={messages.onOuvrir}
          attrs={{ 'data-n-coque-messages': '' }}
          pastille={messages.n ? <Pastille ton="ambre-plein" className="n-coin-pastille">{messages.n}</Pastille> : null}
        />
      ) : null}
      <BoutonIcone
        libelle={tr('natif.plus.ouvrir')}
        icone={<Avatar compte={compte}/>}
        onClick={() => poserPlus(true)}
        attrs={{ 'data-n-coque-plus': '', 'aria-haspopup': 'dialog', 'aria-expanded': ouvertPlus ? 'true' : 'false' }}
        pastille={aPastillePlus ? <span className="n-coin-point" aria-hidden="true"/> : null}
      />
    </>
  );

  const groupesLateraux = React.useMemo(() => [
    { entrees: onglets.map((o) => ({ ...o, icone: o.iconeLaterale || o.icone })) },
    ...plus.map((g) => ({ titre: g.titre || '', entrees: g.entrees.map((o) => ({ ...o, icone: o.iconeLaterale || o.icone })) })),
  ], [onglets, plus]);

  const contexte = React.useMemo(() => ({ titreRendu: false, voletDetail: trois ? volet : null, actions: actionsBarre, ordinateur }), [trois, volet, actionsBarre, ordinateur]);

  const ecran = titre
    ? <Page titre={titre} actions={actionsBarre} recherche={recherche}>{children}</Page>
    : children;

  return (
    <div ref={ref} className={cx('n-coque', className)} data-n-coque="" data-n-volets={ordinateur ? (trois ? 'trois' : 'deux') : undefined} {...(attrs || {})}>
      {ordinateur ? (
        <BarreLaterale
          tete={marque}
          groupes={groupesLateraux}
          actif={actif}
          onChoisir={choisir}
          pied={compte ? (
            <button type="button" className="n-laterale-compte" data-n-coque-plus="" aria-haspopup="dialog" aria-expanded={ouvertPlus ? 'true' : 'false'} onClick={() => poserPlus(true)}>
              <Avatar compte={compte}/>
              <span className="n-laterale-compte-textes">
                <span className="n-laterale-compte-nom">{compte.nom || tr('natif.plus.titre')}</span>
                {compte.sousTitre ? <span className="n-laterale-compte-sous">{compte.sousTitre}</span> : null}
              </span>
            </button>
          ) : null}
        />
      ) : null}
      <ContexteCoque.Provider value={contexte}>
        <main className="n-coque-ecran" data-n-coque-ecran="">
          {bandeaux ? <div className="n-coque-bandeaux">{bandeaux}</div> : null}
          {ecran}
        </main>
      </ContexteCoque.Provider>
      {trois ? (
        <aside className="n-coque-detail" data-n-coque-detail="" aria-label={tr('natif.detail.nom')}>
          <div className="n-coque-fente" ref={setVolet}/>
          {detail}
          {detail ? null : <div className="n-coque-detail-vide">{detailVide}</div>}
        </aside>
      ) : null}
      {ordinateur ? null : <BarreOnglets onglets={onglets} actif={actif} onChoisir={choisir}/>}
      <Feuille ouverte={ouvertPlus} onFermer={() => poserPlus(false)} titre={tr('natif.plus.titre')} detente="pleine" attrs={{ 'data-n-feuille-plus': '' }}>
        {plusTete}
        {plus.map((g, i) => (
          <Groupe key={g.titre || i} titre={g.titre || ''}>
            {g.entrees.map((o) => (
              <Rangee
                key={o.cle}
                titre={o.libelle}
                icone={o.iconeLaterale || o.icone}
                valeur={o.valeur}
                pastille={o.pastille ? <Pastille ton="ambre-plein" libelle={o.libellePastille || ''}>{o.pastille}</Pastille> : null}
                fin={o.cle === actif ? 'coche' : 'chevron'}
                onClick={() => choisirPlus(o)}
                attrs={{ 'data-n-plus-entree': o.cle }}
              />
            ))}
          </Groupe>
        ))}
        {plusPied}
      </Feuille>
    </div>
  );
}

export default Coque;
