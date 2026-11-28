// ════════════════════════════════════════════════════════════════════════════
//  LE STOCK (19 nov. 2026, lot stock-etiquetage — avant : 17 nov., lot stock-rangement). Design « VRM natif ».
//  Julien, 19 nov. : « Pour chaque article, mets "à ranger maintenant" au lieu que je doive appuyer sur l'article et
//  qu'après ce soit à droite. Fais une meilleure représentation du meuble, avec une animation quand je range l'article
//  dans le meuble. Je veux voir le meuble d'un peu plus loin : qu'il occupe toute la largeur de l'écran, et que
//  "ranger" n'apparaisse que quand on le demande. Je veux tous les meubles de rangement parfaitement dans l'onglet
//  Stock. » Récit : docs/passation/2026-11-19-stock-etiquetage.md.
//
//  L'ÉCRAN, de haut en bas :
//    · « Stock », le champ « Où est… » (un N° tapé ou dit ⇒ SA place, en grand, sur son meuble dessiné) ;
//    · « À ranger · N » : une rangée par article, « Ranger » au bout — le toucher de la rangée ouvre la séance sur
//      CET article (plus de fiche à droite) ; balayer ⇒ « Fiche » ;
//    · Meubles · Articles : Meubles = TOUS les meubles dessinés, chacun sur toute la largeur (côte à côte à
//      l'ordinateur), lisibles de loin (le N° en grand, jamais de photo) ; un toucher ZOOME sur un meuble (ses cases se
//      touchent : les gestes d'avant, `toucherCase`). Articles = ceux déjà dans une case, et les blocs d'avant.
//  LA SÉANCE « RANGER » (une feuille, seulement quand on la demande) : l'article, la case proposée sur le meuble dessiné
//  en grand ; « Ranger ici » ou le toucher d'une autre case ; l'article VOLE dans sa case (260 ms, courbe iOS ;
//  mouvement réduit ⇒ fondu seul), la suivante arrive. « Déplacer » = la même séance sur une paire.
//  CE QUI NE CHANGE PAS (les règles, toutes chez l'appelant, src/ecrans/Stock.jsx) : la pose (`poser`, qui DEMANDE si la
//  case est prise, la gravité des piles, lire-fusionner-réécrire de `vrm_slots`), les cases proposées (`casesProposees`,
//  `caseLibreDans`, `premiereCaseLibre`, src/ouRanger.js) — on range un ARTICLE (une annonce), jamais un achat —, la
//  recherche par IDENTITÉ de N°, la case allumée d'une vendue et sa sortie. Aucun N° n'est écrit, changé ni deviné
//  ici : ce composant ne connaît que des clés `cleNum` et appelle les gestes de l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre, langueCourante } from '../i18n/index.js';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import { motsVendeur } from '../profilVendeur.js';   // (26 nov.) exemples de Sneakers seulement chez qui vend des sneakers
import MenuPlateforme from '../designV2/MenuPlateforme.jsx';
import ARegler from '../designV2/ARegler.jsx';   // (19 nov.) « À régler » : l'inventaire en cours, les nouveaux N° à écrire
import { Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Segmente, Feuille, Attente, Champ, Vide } from '../natif/index.js';
import ArrivesARanger from '../ArrivesARanger.jsx';   // (20 nov., lot arrivee-scan) les achats arrivés, à numéroter et ranger
import { ouvrirRetrouver } from '../retrouverColis.js';
import MeubleDessin from './MeubleDessin.jsx';
import { AFFICHAGES, COULEURS_MEUBLE, reglagesDe, couleurMeuble } from '../etageres/reglages.js';
import { ouvrirLigne, fermerLigne, attrsFicheLigne } from '../ficheLigne.js';   // (19 nov., fiche directe) la fiche d'un article est LA fiche de la paire
import DansFiche from '../DansFiche.jsx';
import AssistantRangement from '../rangement/AssistantRangement.jsx';   // (28 nov., lot agent-rangement) l'assistant : une conversation, puis le plan
import './stock-v2.css';
import './meubles.css';
import './pont.css';   // sans couche : rend aux pièces natives du Stock ce que dit la couche natif

const mouvementReduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const DUREE_VOL = 260;          // ms : l'article vole dans sa case (NATIF.md : 200–300 ms)
const COURBE = 'cubic-bezier(.32, .72, 0, 1)';
const A_RANGER_MONTRES = 5;     // « À ranger » : les 5 premiers, « Voir les N autres » déplie
const PAR_PAGE = 60;

// L'ARTICLE QUI VOLE : une copie de sa photo part de la carte de l'article et se pose dans la case visée.
// Posée sur <body> (une feuille animée a un `transform` : un `position: fixed` dedans serait relatif à elle).
function voler(depuis, vers, photo) {
  if (!depuis || !vers || mouvementReduit()) return null;
  const a = depuis.getBoundingClientRect(), b = vers.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  const g = document.createElement('div');
  g.className = 'sm-vol'; g.setAttribute('data-sm-vol', String(DUREE_VOL)); g.setAttribute('aria-hidden', 'true');
  g.style.left = a.left + 'px'; g.style.top = a.top + 'px'; g.style.width = a.width + 'px'; g.style.height = a.height + 'px';
  if (photo) { const im = document.createElement('img'); im.src = photo; im.alt = ''; g.appendChild(im); }
  document.body.appendChild(g);
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  const k = Math.max(0.2, Math.min(1, Math.min(b.width / a.width, b.height / a.height) * 0.9));
  let anim = null;
  try {
    anim = g.animate([{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.9 }],
      { duration: DUREE_VOL, easing: COURBE, fill: 'forwards' });
    anim.onfinish = () => g.remove(); anim.oncancel = () => g.remove();
  } catch (_) { g.remove(); return null; }
  setTimeout(() => { if (g.isConnected) g.remove(); }, DUREE_VOL + 200);
  return anim;
}

// ── LA SÉANCE « RANGER » (et « Déplacer », la même sur une paire) ─────────────
function Seance({ s, seance, ouverte, fermer }) {
  const { Icon, mots } = s;
  const [faits, setFaits] = React.useState([]);          // clés rangées pendant la séance (dans l'ordre)
  const [passes, setPasses] = React.useState([]);        // clés passées (« Plus tard »)
  const [derniere, setDerniere] = React.useState(null);  // le meuble de la dernière pose (la place proposée suit)
  const [meubleChoisi, setMeubleChoisi] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);
  const [sortie, setSortie] = React.useState(false);     // le vol (260 ms) avant que le suivant arrive
  const refPhoto = React.useRef(null);
  const refCases = React.useRef(new Map());
  const file = seance ? seance.cles : [];
  const cle = file.find((k) => !faits.includes(k) && !passes.includes(k)) || null;
  const f = cle ? s.ficheDe(cle) : null;
  const ou = f ? s.ouEst(f) : null;
  const total = file.length;
  // La case proposée : la première libre du meuble choisi (onglet), sinon de celui de la dernière pose, sinon la
  // première libre de tous (src/ouRanger.js). « Déplacer » ne propose rien : il touche la case.
  const prop = cle && !seance.deplacer ? s.caseProposee(cle, meubleChoisi || derniere) : null;
  const idAffiche = meubleChoisi || (prop && prop.meubleId) || (ou && ou.meuble.id) || (s.meubles[0] && s.meubles[0].id);
  const mAffiche = s.meubles.find((m) => String(m.id) === String(idAffiche)) || null;
  React.useEffect(() => { setMeubleChoisi(null); /* eslint-disable-next-line */ }, [cle]);
  // Fin de séance : « Tout est rangé » se dit, puis la feuille se referme seule.
  React.useEffect(() => { if (cle || !seance) return undefined; const t = setTimeout(fermer, 1400); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [cle, seance]);
  // LE MOUVEMENT INTERRUPTIBLE : pendant le vol, un toucher (n'importe quel geste de la séance) fait arriver le suivant
  // TOUT DE SUITE — il ne repose jamais l'article déjà rangé.
  const attente = React.useRef(null);
  const finirSortie = () => { const a = attente.current; if (!a) return false; attente.current = null; clearTimeout(a.t); a.fin(); return true; };
  React.useEffect(() => () => { const a = attente.current; if (a) clearTimeout(a.t); }, []);
  const poser = async (mid, i) => {
    if (finirSortie()) return;
    if (!cle || enCours) return;
    setEnCours(true);
    let ok = false;
    try { ok = await s.poser(cle, mid, i, { muet: true }); } finally { setEnCours(false); }
    if (ok === false) return;
    const k = cle;
    const fin = () => { setSortie(false); setFaits((x) => (x.includes(k) ? x : [...x, k])); setDerniere(String(mid)); setMeubleChoisi(null); };
    // LE VOL : de la photo de l'article à la case touchée (la case finale, dans une pile, est dite après).
    const vers = String(mAffiche && mAffiche.id) === String(mid) ? refCases.current.get(Number(i)) : null;
    const anim = voler(refPhoto.current, vers, f && f.photo);
    if (!anim) { fin(); return; }
    setSortie(true);
    attente.current = { fin, t: setTimeout(() => { attente.current = null; fin(); }, DUREE_VOL) };
  };
  const reste = Math.max(0, total - faits.length);
  // La dernière pose, DITE avec la case finale (relue : dans une pile, l'article a pu descendre).
  const kFait = faits[faits.length - 1] || null; const fFait = kFait ? s.ficheDe(kFait) : null; const ouFait = fFait ? s.ouEst(fFait) : null;
  const fait = ouFait ? tr('sr.fait', { num: String(fFait.numero), ou: s.placeEnMots(ouFait) }) : '';
  const titre = seance && seance.deplacer ? tr('sr.deplacer.titre') : tr('sr.seance.titre');
  const ouMeuble = ou && mAffiche && String(ou.meuble.id) === String(mAffiche.id) ? ou.i : null;
  const viseIci = prop && mAffiche && String(prop.meubleId) === String(mAffiche.id) ? prop.i : null;
  const pied = cle && prop && viseIci != null
    ? <Bouton variante="plein" chargement={enCours} attrs={{ 'data-sr-ranger-ici': '' }} onClick={() => poser(String(prop.meubleId), prop.i)}>{tr('sr.ici.ranger')}</Bouton>
    : null;
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={titre} detente="pleine" pied={pied} className="sr-feuille sm-feuille"
      attrs={{ 'data-sr-seance': seance && seance.deplacer ? 'deplacer' : 'ranger' }}>
      {!seance ? null : !cle ? (
        <div className="sm-fin" role="status" data-sr-fin={String(faits.length)}>
          <span className="sm-fin-ic" aria-hidden="true"><Icon name="check" size={30}/></span>
          {fait ? <p className="sm-fait" data-sr-fait={kFait}>{fait}</p> : null}
          <p className="sm-fin-titre">{seance.deplacer ? tr('sr.deplacer.fait') : tr('sr.seance.fin', { n: faits.length, mot: faits.length > 1 ? mots.noms : mots.nom })}</p>
        </div>
      ) : (
        <div className="sm-seance" data-sr-courant={cle}>
          {!seance.deplacer && total > 1 ? <p className="sm-reste" key={reste} data-sr-reste={reste}>{tr('sr.seance.reste', { n: reste, nb: nombre(reste) })}</p> : null}
          {fait ? <p className="sm-fait" role="status" data-sr-fait={kFait}><Icon name="check" size={16}/><span>{fait}</span></p> : null}
          <div className="sm-article sm-seance-corps" key={cle}>
            <span className={'sm-article-photo' + (sortie ? ' is-part' : '')} ref={refPhoto}>
              {f && f.photo ? <img src={f.photo} alt="" decoding="async"/> : <Icon name="box" size={30}/>}
              {sortie ? <span className="sm-coche sr-coche" aria-hidden="true"><Icon name="check" size={28}/></span> : null}
            </span>
            <span className="sm-article-txt">
              <Plaque numero={f ? f.numero : cle} grand doublon={!!(f && s.estDouble(cle))}/>
              <span className="sm-article-titre">{(f && f.title) || '—'}</span>
              {ou ? <span className="sm-article-ou" data-sr-ou-avant="">{tr('sr.deplacer.avant', { ou: s.placeEnMots(ou) })}</span> : null}
            </span>
          </div>
          {prop && viseIci != null ? (
            <p className="sm-propose" data-sr-propose={prop.meubleId + ':' + prop.i} data-sr-propose-suite={derniere && String(derniere) === String(prop.meubleId) ? '' : undefined}>
              <span className="sm-propose-l">{derniere && String(derniere) === String(prop.meubleId) ? tr('sr.ici.suite') : tr('sr.ici.l')}</span>
              <span className="sm-propose-ou">{prop.meuble} · {tr('sr.ici.case', { r: nombre(prop.rangee), c: nombre(prop.colonne) })}</span>
            </p>
          ) : null}
          {!s.meubles.length ? <p className="sm-sans" data-sr-sans-case="">{tr('sr.ici.aucunMeuble')}</p>
            : !seance.deplacer && !prop ? <p className="sm-sans" data-sr-sans-case="">{tr('sr.ici.plein')}</p> : null}
          {s.meubles.length > 1 ? (
            <div className="sm-onglets" role="tablist" aria-label={tr('sr.choix.meubles')}>
              {s.meubles.map((m) => (
                <button key={m.id} type="button" role="tab" className="sm-onglet" aria-selected={!!mAffiche && String(mAffiche.id) === String(m.id)} data-sr-onglet={m.id}
                  onClick={() => { if (!finirSortie()) setMeubleChoisi(String(m.id)); }}>{m.name}</button>
              ))}
            </div>
          ) : null}
          {mAffiche ? (
            <div className="sm-defile" data-sr-grille={mAffiche.id}>
              <MeubleDessin m={mAffiche} info={(i) => s.caseInfo(mAffiche.id, i)} mode="pres" vise={viseIci} ici={ouMeuble} arrivee={kFait || ''}
                refCase={(i, el) => { if (el) refCases.current.set(i, el); else refCases.current.delete(i); }}
                onCase={enCours ? null : (i) => poser(String(mAffiche.id), i)}/>
            </div>
          ) : null}
          {mAffiche ? <p className="sm-aide">{tr('sm.seance.aide')}</p> : null}
          <div className="sm-gestes-bas">
            {!seance.deplacer && total > 1 ? <Bouton variante="texte" attrs={{ 'data-sr-passer': '' }} onClick={() => { if (!finirSortie()) setPasses((x) => [...x, cle]); }}>{tr('sr.seance.passer')}</Bouton> : null}
            {!s.meubles.length ? <Bouton variante="teinte" attrs={{ 'data-sr-creer-meuble': '' }} onClick={() => { fermer(); s.creerMeuble(); }}>{tr('sr.places.ajouter')}</Bouton> : null}
          </div>
        </div>
      )}
    </Feuille>
  );
}

// ── LA PLACE D'UN ARTICLE (« Où est… », le toucher d'une rangée « Dans une case ») ─────
function Reponse({ s, f, onDeplacer, onRanger, onVoir, sansTete = false }) {
  const { Icon } = s;
  const ou = s.ouEst(f);
  const vendue = s.estVendu(f);
  const k = s.cleDe(f);
  return (
    <div className="sm-seance" data-sr-reponse={k} data-sr-reponse-ou={ou ? `${ou.meuble.name}|${ou.rangee}|${ou.colonne}` : 'non-range'}>
      {sansTete ? null : <div className="sm-article">
        <span className="sm-article-photo">{f.photo ? <img src={f.photo} alt="" loading="lazy" decoding="async"/> : <Icon name="box" size={30}/>}</span>
        <span className="sm-article-txt">
          <Plaque numero={f.numero} grand doublon={s.estDouble(k)}/>
          <span className="sm-article-titre">{f.title || '—'}</span>
          {vendue ? <span className="sm-article-ou" data-sr-vendue="">{tr('sr.reponse.vendue')}</span> : null}
        </span>
      </div>}
      {ou ? <>
        <p className="sm-propose" data-sr-etiquette-place="">
          <span className="sm-propose-l">{tr('sm.reponse.ici')}</span>
          <span className="sm-propose-ou" data-sr-reponse-meuble="">{ou.meuble.name} · {tr('sr.ici.case', { r: nombre(ou.rangee), c: nombre(ou.colonne) })}</span>
        </p>
        <MeubleDessin m={ou.meuble} info={(i) => s.caseInfo(ou.meuble.id, i)} mode="loin" vise={ou.i}/>
      </> : <p className="sm-sans" data-sr-reponse-pas-rangee="">{tr('sr.reponse.pasRangee')}</p>}
      <div className="sm-gestes">
        {!ou && !vendue && s.peutRanger(k) ? <Bouton variante="teinte" attrs={{ 'data-sr-ranger-maintenant': '' }} onClick={onRanger}>{tr('sr.reponse.ranger')}</Bouton> : null}
        {ou ? <Bouton variante="teinte" attrs={{ 'data-sr-voir': '' }} onClick={onVoir}>{tr('sr.reponse.voir')}</Bouton> : null}
        {ou && !vendue ? <Bouton variante="teinte" attrs={{ 'data-sr-deplacer': '' }} onClick={onDeplacer}>{tr('sr.reponse.deplacer')}</Bouton> : null}
        {sansTete ? null : <Bouton variante="texte" attrs={{ 'data-sr-tout-sur': k }} onClick={() => { const n = String(f.numero); try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })); } catch (_) {} }}>{tr('sr.reponse.fiche')}</Bouton>}
      </div>
    </div>
  );
}

// ── « ⋯ » : ce qui n'est pas compté (chacun avec SON geste) et les outils du Stock. ──
function FeuillePlus({ s, ouverte, fermer, ouvrirAssistant }) {
  const { Icon } = s;
  const geste = (f) => () => { fermer(); setTimeout(f, 60); };
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={tr('sr.menu.titre')} className="sr-feuille" attrs={{ 'data-sr-plus': '' }}>
      {s.etats.length ? (
        <Groupe titre={tr('sr.menu.verifier')}>
          {s.etats.map((e) => <Rangee key={e.k} titre={e.titre} sousTitre={e.geste} sousLignes={2} ton={e.ambre ? 'ambre' : 'neutre'} fin={e.faire ? 'chevron' : null}
            onClick={e.faire ? geste(e.faire) : null} attrs={{ 'data-sr-etat': e.k }}/>)}
        </Groupe>) : null}
      <Groupe titre={tr('sr.menu.outils')}>
        <Rangee icone={<Icon name="box" size={22}/>} titre={tr('arv.action')} onClick={geste(() => ouvrirRetrouver('stock', '', 'arrivee'))} attrs={{ 'data-arv-bouton': 'stock-plus' }}/>
        <Rangee icone={<Icon name="camera" size={22}/>} titre={tr('stock.trouverPhoto')} onClick={geste(s.ouvrirPhoto)} attrs={{ 'data-stock-recherche-photo': '' }}/>
        <Rangee icone={<Icon name="scan" size={22}/>} titre={tr('stock.faireInventaire')} onClick={geste(s.ouvrirInventaire)} attrs={{ 'data-stock-inventaire-ouvrir': '' }}/>
        <Rangee icone={<Icon name="box" size={22}/>} titre={tr('sr.places.ajouter')} onClick={geste(s.creerMeuble)} attrs={{ 'data-creer-meuble': '' }}/>
        {ouvrirAssistant ? <Rangee icone={<Icon name="spark" size={22}/>} titre={tr('rgt.ouvrir')} fin="chevron" onClick={ouvrirAssistant} attrs={{ 'data-rgt-ouvrir': 'menu' }}/> : null}
        <Rangee icone={<Icon name="tag" size={22}/>} titre={tr('sm.menu.etiquetage')} sousTitre={s.etiquetage ? s.etiquetage.resume : ''} fin="chevron" onClick={geste(s.ouvrirEtiquetage)} attrs={{ 'data-sm-vers-etiquetage': '' }}/>
        <Rangee icone={<Icon name="tag" size={22}/>} titre={tr('sr.menu.annonces')} fin="chevron" onClick={geste(s.versAnnonces)} attrs={{ 'data-sr-vers-annonces': '' }}/>
      </Groupe>
    </Feuille>
  );
}

// ── « PERSONNALISER » UN MEUBLE (20 nov., « ce qui manque ») — une page native simple : nom, style, couleur, cases. ──
// Rien n'est écrit avant « Enregistrer » (le plein de la feuille) ; l'écriture est celle du Stock (`s.personnaliserMeuble` →
// `enregistrerMeuble` : `vrm_meubles` sur main, et la question quand un meuble rétréci fait sortir des paires). Aucun N°
// n'est touché. « Plus de réglages » ouvre l'éditeur complet d'hier (couleurs de cases, piles, planches).
function Personnaliser({ s, m, ouverte, fermer }) {
  const { Icon } = s;
  const [nom, setNom] = React.useState(m ? String(m.name || '') : '');
  const [affichage, setAffichage] = React.useState(m ? reglagesDe(m).affichage : 'cartons');
  const [couleur, setCouleur] = React.useState(m ? couleurMeuble(m) : 'ciel');
  const [cols, setCols] = React.useState(m ? Math.max(1, Number(m.cols) || 1) : 4);
  const [rows, setRows] = React.useState(m ? Math.max(1, Number(m.rows) || 1) : 3);
  const [enCours, setEnCours] = React.useState(false);
  if (!m) return null;
  const L = s.limitesMeuble || { cols: 30, rows: 50 };
  const pas = (quoi, v, set, max) => (
    <span className="sm-pas">
      <BoutonIcone libelle={tr('cqm.meuble.moins', { quoi: tr('cqm.meuble.' + quoi).toLowerCase() })} icone={<Icon name="minus" size={20}/>} indisponible={v <= 1} onClick={() => set(Math.max(1, v - 1))} attrs={{ 'data-sm-perso-moins': quoi }}/>
      <span className="sm-pas-n" data-sm-perso-n={quoi}>{nombre(v)}</span>
      <BoutonIcone libelle={tr('cqm.meuble.plus', { quoi: tr('cqm.meuble.' + quoi).toLowerCase() })} icone={<Icon name="plus" size={20}/>} indisponible={v >= max} onClick={() => set(Math.min(max, v + 1))} attrs={{ 'data-sm-perso-plus': quoi }}/>
    </span>
  );
  const enregistrer = async () => {
    if (enCours) return;
    setEnCours(true);
    let ok = false;
    try { ok = await s.personnaliserMeuble(m.id, { name: nom, cols, rows, couleur, affichage }); } finally { setEnCours(false); }
    if (ok !== false) fermer();
  };
  const apercu = { ...m, name: nom || m.name, cols, rows, couleur, reglages: { ...(m.reglages || {}), affichage } };
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={tr('cqm.meuble.personnaliser')} detente="pleine" className="sr-feuille sm-feuille"
      pied={<Bouton variante="plein" chargement={enCours} onClick={enregistrer} attrs={{ 'data-sm-perso-enregistrer': m.id }}>{tr('cqm.meuble.enregistrer')}</Bouton>}
      attrs={{ 'data-sm-perso': m.id }}>
      <div className="sm-perso-apercu" aria-hidden="true"><MeubleDessin m={apercu} info={(i) => (i < (Number(m.cols) || 1) * (Number(m.rows) || 1) ? s.caseInfo(m.id, i) : null)} mode="loin"/></div>
      <Groupe>
        <div className="sm-carte-pad"><Champ libelle={tr('cqm.meuble.nom')} valeur={nom} onChange={setNom} attrs={{ 'data-sm-perso-nom': '', maxLength: 40 }}/></div>
      </Groupe>
      <Groupe titre={tr('cqm.meuble.style')}>
        <div className="sm-carte-pad">
          <Segmente libelle={tr('cqm.meuble.style')} valeur={affichage} onChange={setAffichage} options={AFFICHAGES.map((a) => ({ cle: a, libelle: tr('cqm.meuble.style.' + a) }))}/>
        </div>
      </Groupe>
      <Groupe titre={tr('cqm.meuble.couleur')}>
        {COULEURS_MEUBLE.map((c) => <Rangee key={c} icone={<i className="vrm-etag-pastille" data-couleur={c} aria-hidden="true"/>} titre={tr('etag.couleur.' + c)} fin={couleur === c ? 'coche' : null}
          onClick={() => setCouleur(c)} attrs={{ 'data-sm-perso-couleur': c, 'aria-pressed': couleur === c ? 'true' : 'false' }}/>)}
      </Groupe>
      <Groupe titre={tr('cqm.meuble.cases')} pied={tr('cqm.meuble.total', { n: cols * rows })}>
        <Rangee titre={tr('cqm.meuble.colonnes')} valeur={pas('colonnes', cols, setCols, L.cols)}/>
        <Rangee titre={tr('cqm.meuble.rangees')} valeur={pas('rangees', rows, setRows, L.rows)}/>
      </Groupe>
      <Groupe>
        <Rangee titre={tr('sr.place.modifier')} fin="chevron" onClick={() => { fermer(); setTimeout(() => s.modifierMeuble(m), 60); }} attrs={{ 'data-sr-modifier-meuble': m.id }}/>
      </Groupe>
    </Feuille>
  );
}

// ── « LA PIÈCE » (20 nov.) — l'ordre des meubles, une rangée chacun, Monter / Descendre (la même écriture `ordre`). ──
function LaPiece({ s, ouverte, fermer }) {
  const { Icon } = s;
  const n = s.meubles.length;
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={tr('cqm.piece.titre')} className="sr-feuille sm-feuille" attrs={{ 'data-sm-piece': n }}>
      <Groupe titre={tr('sm.seg.meubles')}>
        {s.meubles.map((m, k) => (
          <Rangee key={m.id} icone={<i className="vrm-etag-pastille" data-couleur={couleurMeuble(m)} aria-hidden="true"/>} titre={m.name || '—'}
            sousTitre={tr('cqm.meuble.total', { n: (Number(m.cols) || 1) * (Number(m.rows) || 1) })}
            valeur={<span className="sm-pas">
              <BoutonIcone libelle={tr('cqm.piece.monter', { nom: m.name || '' })} icone={<Icon name="chevronHaut" size={20}/>} indisponible={k === 0} onClick={() => s.placerMeubleA(m.id, k - 1)} attrs={{ 'data-sr-monter': m.id }}/>
              <BoutonIcone libelle={tr('cqm.piece.descendre', { nom: m.name || '' })} icone={<Icon name="chevronBas" size={20}/>} indisponible={k === n - 1} onClick={() => s.placerMeubleA(m.id, k + 1)} attrs={{ 'data-sr-descendre': m.id }}/>
            </span>}
            attrs={{ 'data-sm-piece-meuble': m.id, 'data-sm-piece-rang': String(k) }}/>
        ))}
      </Groupe>
    </Feuille>
  );
}

// ── GLISSER-DÉPOSER À LA SOURIS (20 nov.) : une paire d'une case à l'autre, dans le meuble zoomé. ──
// La souris seulement (au doigt, le toucher garde ses gestes : fiche, « Déplacer ») ; au-delà de 6 px le geste devient un
// glisser, la case survolée s'allume ; au lâcher sur une AUTRE case, la pose est celle de « Déplacer » (`s.poser` : une case
// prise DEMANDE, `vrm_slots` relu-fusionné) — jamais un N° changé. Échap ou lâcher ailleurs : rien.
function useGlisserCase(s, m) {
  const g = React.useRef(null);
  const caseSous = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest ? el.closest('[data-sm-case]') : null; if (!c) return null; const [mid, i] = String(c.getAttribute('data-sm-case')).split(':'); return String(mid) === String(m.id) ? { el: c, i: Number(i) } : null; };
  const nettoyer = () => { const x = g.current; g.current = null; if (!x) return; document.removeEventListener('pointermove', x.bouge); document.removeEventListener('pointerup', x.fin); document.removeEventListener('keydown', x.touche, true);
    if (x.fantome) x.fantome.remove(); if (x.cible) x.cible.removeAttribute('data-sm-glisse-cible'); if (x.source) x.source.removeAttribute('data-sm-glisse-source'); document.documentElement.removeAttribute('data-sm-glisse'); };
  React.useEffect(() => nettoyer, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const onPointerDown = (e) => {
    if (!m || e.pointerType !== 'mouse' || e.button !== 0) return;
    const c = e.target && e.target.closest ? e.target.closest('[data-sm-case]') : null;
    if (!c || !c.getAttribute('data-case-num')) return;
    const i = Number(String(c.getAttribute('data-sm-case')).split(':')[1]);
    const info = s.caseInfo(m.id, i);
    if (!info || !info.cle || info.notee) return;
    const x0 = e.clientX, y0 = e.clientY;
    const etat = { de: i, cle: info.cle, num: info.num, source: c, cible: null, vers: null, fantome: null, actif: false };
    etat.bouge = (ev) => {
      if (!etat.actif) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; etat.actif = true; c.setAttribute('data-sm-glisse-source', ''); document.documentElement.setAttribute('data-sm-glisse', '');
        const f = document.createElement('div'); f.className = 'sm-glisse-fantome'; f.setAttribute('aria-hidden', 'true'); f.textContent = String(info.num); document.body.appendChild(f); etat.fantome = f; }
      ev.preventDefault();
      etat.fantome.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
      const sous = caseSous(ev.clientX, ev.clientY);
      const el = sous && sous.i !== etat.de ? sous.el : null;
      if (el !== etat.cible) { if (etat.cible) etat.cible.removeAttribute('data-sm-glisse-cible'); if (el) el.setAttribute('data-sm-glisse-cible', ''); etat.cible = el; }
      etat.vers = el ? sous.i : null;
    };
    etat.fin = () => {
      const actif = etat.actif, vers = etat.vers;
      nettoyer();
      if (!actif) return;
      // Le clic qui suit un glisser ne doit pas rejouer le toucher de la case de départ.
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', stop, { capture: true }), 0);
      if (vers != null) s.poser(etat.cle, String(m.id), vers);
    };
    etat.touche = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); etat.actif = false; nettoyer(); } };
    g.current = etat;
    document.addEventListener('pointermove', etat.bouge); document.addEventListener('pointerup', etat.fin); document.addEventListener('keydown', etat.touche, true);
  };
  return { onPointerDown };
}

// ── TOUS LES MEUBLES : la vue d'ensemble, puis un meuble zoomé ────────────────
function Meubles({ s, zoom, setZoom, vise, ouvrirAssistant }) {
  const { Icon } = s;
  const m = zoom ? s.meubles.find((x) => String(x.id) === String(zoom)) : null;
  const [perso, setPerso] = React.useState(null);
  const [piece, setPiece] = React.useState(false);
  const glisser = useGlisserCase(s, m);
  if (m) {
    const c = s.compteMeuble(m);
    return (
      <section className="sm-zoom" data-sm-zoom={m.id} data-sr-place={m.id} data-ouvert="1" aria-label={m.name}>
        <div className="sm-zoom-tete">
          <Bouton variante="texte" attrs={{ 'data-sm-dezoom': '' }} onClick={() => setZoom(null)}>{tr('sm.tous')}</Bouton>
        </div>
        <div>
          <h2 className="sm-zoom-nom">{m.name}</h2>
          <p className="sm-zoom-n">{tr('sr.places.plein', { n: c.pleines, t: nombre(c.total) })}{c.aSortir ? <span className="sm-tuile-sortir" data-sr-a-sortir={c.aSortir}> · {tr('sr.places.aSortir', { n: c.aSortir })}</span> : null}</p>
        </div>
        <div className="sm-defile" onPointerDown={glisser.onPointerDown} data-sm-glisser={m.id}>
          <MeubleDessin m={m} info={(i) => s.caseInfo(m.id, i)} mode="pres" vise={vise && String(vise.m) === String(m.id) ? vise.i : null} onCase={(i) => s.toucherCase(m.id, i)}/>
        </div>
        <p className="sm-aide">{tr('sm.zoom.aide')}</p>
        {/* (20 nov., « ce qui manque ») « Personnaliser » (page native) et « La pièce » (l'ordre des meubles) remplacent
            « Modifier » et Monter / Descendre ici ; l'éditeur complet reste derrière « Personnaliser ». */}
        <div className="sm-gestes">
          <Bouton variante="teinte" icone={<Icon name="pencil" size={18}/>} attrs={{ 'data-sm-perso-ouvrir': m.id }} onClick={() => setPerso(String(m.id))}>{tr('cqm.meuble.personnaliser')}</Bouton>
          {s.meubles.length > 1 ? <Bouton variante="texte" attrs={{ 'data-sm-piece-ouvrir': '' }} onClick={() => setPiece(true)}>{tr('cqm.piece.titre')}</Bouton> : null}
        </div>
        <Personnaliser key={'p' + m.id + ':' + (perso || '')} s={s} m={m} ouverte={perso === String(m.id)} fermer={() => setPerso(null)}/>
        <LaPiece s={s} ouverte={piece} fermer={() => setPiece(false)}/>
      </section>
    );
  }
  // (28 nov., lot agent-rangement) Les meubles groupés par PIÈCE dès qu'il y en a deux (le champ `piece` posé par l'assistant) ;
  // dans chaque pièce, l'ordre d'hier. Une seule pièce (ou aucune) : la liste d'hier, sans titre.
  const pieces = [];
  for (const x of s.meubles) { const p = typeof x.piece === 'string' && x.piece.trim() ? x.piece.trim() : ''; let g = pieces.find((y) => y.nom === p); if (!g) { g = { nom: p, meubles: [] }; pieces.push(g); } g.meubles.push(x); }
  const parPiece = pieces.length > 1;
  const tuile = (x) => { const c = s.compteMeuble(x); return (
        <button key={x.id} type="button" className="sm-tuile" data-sr-place-ouvrir={x.id} data-sm-tuile={x.id} data-sm-large={Number(x.cols) >= 6 ? '' : undefined} onClick={() => setZoom(String(x.id))}
          aria-label={`${x.name} · ${tr('sr.places.plein', { n: c.pleines, t: nombre(c.total) })}${c.aSortir ? ' · ' + tr('sr.places.aSortir', { n: c.aSortir }) : ''}`}>
          <span className="sm-tuile-tete">
            <span className="sm-tuile-nom">{x.name}{x.porte ? <span className="sm-tuile-porte" data-sm-porte="">{tr('rgt.porte')}</span> : null}</span>
            <span className="sm-tuile-n">{tr('sr.places.plein', { n: c.pleines, t: nombre(c.total) })}{c.aSortir ? <span className="sm-tuile-sortir" data-sr-a-sortir={c.aSortir}> · {tr('sr.places.aSortir', { n: c.aSortir })}</span> : null}</span>
          </span>
          <MeubleDessin m={x} info={(i) => s.caseInfo(x.id, i)} mode="loin" vise={vise && String(vise.m) === String(x.id) ? vise.i : null}/>
        </button>); };
  return (
    <section className="sm-tous" data-sr-places={s.meubles.length} data-sm-tous={s.meubles.length} data-sm-pieces={parPiece ? pieces.length : undefined}>
      {s.meubles.length ? <button type="button" className="sm-assistant" data-rgt-ouvrir="" onClick={ouvrirAssistant}>
        <span className="sm-assistant-ic" aria-hidden="true">{Icon ? <Icon name="spark" size={20}/> : null}</span>
        <span className="sm-assistant-mots"><span className="sm-assistant-titre">{tr('rgt.ouvrir')}</span><span className="sm-assistant-detail">{tr('rgt.ouvrirDetail')}</span></span>
      </button> : null}
      {/* (21 nov., ux-reglages, audit design n° 29) Aucun meuble : le `Vide` natif (une icône, une phrase, « Créer mon
          premier meuble ») à la place de la carte « Comment marche le Stock » permanente (l'explication reste derrière le « ? »). */}
      {s.meubles.length === 0 ? <Vide icone={Icon ? <Icon name="grid" size={40}/> : null} phrase={tr('uxr.vide.stock')} detail={tr('uxr.vide.stockDetail')}
        action={<span className="sm-vide-gestes"><Bouton variante="teinte" icone={Icon ? <Icon name="spark" size={18}/> : null} attrs={{ 'data-rgt-ouvrir': 'vide' }} onClick={ouvrirAssistant}>{tr('rgt.ouvrir')}</Bouton>
          <Bouton variante="texte" attrs={{ 'data-creer-meuble': '', 'data-ux-vide-geste': 'meuble' }} onClick={s.creerMeuble}>{tr('uxr.vide.stockGeste')}</Bouton></span>}/> : null}
      {parPiece ? pieces.map((g) => <React.Fragment key={'p:' + g.nom}><h2 className="sm-piece" data-sm-piece-titre={g.nom || '-'}>{g.nom || tr('rgt.piece.defaut')}</h2>{g.meubles.map(tuile)}</React.Fragment>) : s.meubles.map(tuile)}
      {s.meubles.length ? <button type="button" className="sm-tuile sm-tuile-ajout" data-creer-meuble="" onClick={s.creerMeuble}>+ {tr('sr.places.ajouter')}</button> : null}
    </section>
  );
}

export default function StockV2({ s }) {
  const { Icon, Mic, mots } = s;
  const [seance, setSeance] = React.useState(null);      // { cles: [...], deplacer: bool }
  const [seanceOuverte, setSeanceOuverte] = React.useState(false);
  const [choisi, setChoisi] = React.useState(null);      // une clé choisie parmi plusieurs résultats
  const [vue, setVueEtat] = React.useState(() => { try { const v = localStorage.getItem('vrm_stock_v2_vue'); return v === 'paires' || v === 'articles' ? 'articles' : 'meubles'; } catch (_) { return 'meubles'; } });
  const setVue = (v) => { setVueEtat(v); try { localStorage.setItem('vrm_stock_v2_vue', v); } catch (_) {} };
  const [zoom, setZoom] = React.useState(null);          // le meuble zoomé (son id)
  const [vise, setVise] = React.useState(null);          // { m, i } : la case montrée (« Voir sur le plan »)
  const [plus, setPlus] = React.useState(false);
  const [assistant, setAssistant] = React.useState(false);   // (28 nov., lot agent-rangement)
  const [tousARanger, setTousARanger] = React.useState(false);
  const [max, setMax] = React.useState(PAR_PAGE);
  const aRangerCles = s.aRanger.map(s.cleDe).filter(Boolean);
  const lancer = (cles, deplacer = false) => { if (cles.length) { fermerLigne(); setSeance({ cles, deplacer, id: Date.now() }); setSeanceOuverte(true); } };
  const rangerA = (k) => lancer([k, ...aRangerCles.filter((x) => x !== k)]);
  // La feuille anime sa sortie (300 ms) avant que la séance soit oubliée ; une séance relancée entre-temps reste.
  const fermerSeance = () => { const id = seance ? seance.id : null; setSeanceOuverte(false); setTimeout(() => setSeance((x) => (x && x.id === id ? null : x)), 320); };
  // Une demande « ranger / déplacer CE N° » (Annonces, la fiche « Déplacer ») : la séance s'ouvre sur lui.
  React.useEffect(() => {
    if (!s.place) return;
    const k = s.place; s.setPlace(null);
    const f = s.ficheDe(k);
    if (f && s.ouEst(f)) lancer([k], true); else rangerA(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.place]);
  // « Voir sur le plan » : Meubles, CE meuble zoomé, SA case qui respire.
  const voir = (f) => { const ou = s.ouEst(f); if (ou) { setVue('meubles'); setZoom(String(ou.meuble.id)); setVise({ m: String(ou.meuble.id), i: ou.i }); setTimeout(() => setVise(null), 4000); } s.montrer(f); };
  const exact = s.qEstNum ? s.resultats.filter((f) => s.exactNum(f)) : [];
  const un = choisi ? s.resultats.find((f) => s.cleDe(f) === choisi) : (exact.length === 1 ? exact[0] : (s.resultats.length === 1 ? s.resultats[0] : null));
  React.useEffect(() => { setChoisi(null); }, [s.q]);
  // Le compte du bouton ne bouge pas non plus sous la feuille (il suivait chaque pose : la ligne du titre sautait).
  const nGel = React.useRef(null);
  if (seanceOuverte && nGel.current == null) nGel.current = aRangerCles.length;
  if (!seanceOuverte) nGel.current = null;
  const nPlein = seanceOuverte && nGel.current != null ? nGel.current : aRangerCles.length;
  const chercheVide = !s.q.trim();
  const lignes = s.lignes;
  const nonRangeesVives = lignes.filter((l) => l.cle && !l.ou), rangees = lignes.filter((l) => !l.cle || l.ou);
  // Pendant la séance, la liste « À ranger » de l'écran (sous la feuille) ne bouge pas : elle se met à jour à la fermeture
  // (rien ne saute derrière la feuille ; mesuré au banc stock-rangement, CLS 0,16 à 1512).
  const gel = React.useRef(null);
  if (seanceOuverte && !gel.current) gel.current = nonRangeesVives;
  if (!seanceOuverte && gel.current) gel.current = null;
  const nonRangees = seanceOuverte && gel.current ? gel.current : nonRangeesVives;
  // (19 nov., « fiche directe », lot fiche-directe fusionné) La fiche d'un article est LA fiche de la paire (src/ficheLigne.js) :
  // sa place (le meuble dessiné, la case qui respire) et ses gestes « Voir », « Déplacer », « Ranger » y sont posés par
  // `DansFiche` (place « contexte »). « À ranger » garde SON toucher : il range (Julien) ; la fiche y est un balayage.
  const lireLigneDe = (x) => ({ cle: 'stock:stock:s' + x.cle, contexte: 'stock', site: 'stock', nums: [String(x.numero)], item: '', tx: '', suivi: '', photo: x.photo || '', titre: x.titre || '', prix: '', sous: '' });
  const ouvrirFiche = (l) => { if (l.cle && s.ficheDe(l.cle)) ouvrirLigne(lireLigneDe(l)); };
  const dansFiche = (l) => { const f = l.cle ? s.ficheDe(l.cle) : null; return f ? <DansFiche key={'df' + l.key} cle={'stock:stock:s' + l.cle} place="contexte" seulementFiche>
    <Reponse s={s} f={f} sansTete onVoir={() => { fermerLigne(); voir(f); }} onDeplacer={() => { fermerLigne(); lancer([l.cle], true); }} onRanger={() => { fermerLigne(); rangerA(l.cle); }}/>
  </DansFiche> : null; };
  // « À RANGER » : la rangée entière range CET article (Julien : plus de « toucher l'article, puis à droite »).
  const ligneARanger = (l) => {
    const peut = s.peutRanger(l.cle);
    return <Rangee key={l.key} vignette={<Vignette src={l.photo || ''} alt=""/>} titre={l.titre || '—'} lignes={2} plaque={<Plaque numero={l.numero} doublon={!!l.double}/>}
      sousTitre={l.taille ? tr('v2.l.taille', { t: l.taille }) : ''} fin={peut ? <span className="sm-ranger-fin">{tr('sm.ranger')}</span> : 'chevron'}
      onClick={() => (peut ? rangerA(l.cle) : ouvrirFiche(l))}
      actions={[{ cle: 'fiche', libelle: tr('sm.fiche'), ton: 'neutre', onClick: () => ouvrirFiche(l) }]}
      attrs={{ 'data-sr-ligne': l.cle, 'data-sr-ligne-place': 'non-range', 'data-sm-ranger': peut ? l.cle : undefined, 'aria-label': [tr('sm.rangerNum', { num: String(l.numero) }), l.titre].filter(Boolean).join(' · ') }}/>;
  };
  const ligneRangee = (l) => {
    const place = l.ou ? s.placeEnMots(l.ou) : '';
    return <Rangee key={l.key} vignette={<Vignette src={l.photo || ''} alt=""/>} titre={l.titre || '—'} lignes={2} plaque={l.cle ? <Plaque numero={l.numero} doublon={!!l.double}/> : null}
      sousTitre={l.cle ? [l.taille ? tr('v2.l.taille', { t: l.taille }) : '', place].filter(Boolean).join(' · ') : tr('sr.ligne.sansNum')} fin={l.cle ? 'chevron' : null}
      onClick={l.cle ? () => ouvrirFiche(l) : null}
      actions={l.cle && l.ou ? [{ cle: 'deplacer', libelle: tr('sr.glisse.deplacer'), onClick: () => lancer([l.cle], true) }] : null}
      attrs={{ ...(l.cle ? attrsFicheLigne({ contexte: 'stock', site: 'stock', cle: 's' + l.cle, nums: [String(l.numero)], photo: l.photo || '', titre: l.titre || '' }) : {}), 'data-sr-ligne': l.cle || 'sans', 'data-sr-ligne-place': l.ou ? `${l.ou.meuble.name}|${l.ou.rangee}|${l.ou.colonne}` : (l.cle ? 'non-range' : 'sans-numero') }}/>;
  };
  const aRangerVus = tousARanger ? nonRangees.slice(0, max) : nonRangees.slice(0, A_RANGER_MONTRES);
  const rangeesVues = rangees.slice(0, max);
  const etiq = s.etiquetage;
  const imprimer = etiq && etiq.support === 'imprimee' && nonRangees.length
    ? <Bouton variante="texte" attrs={{ 'data-sm-imprimer': nonRangees.length }} onClick={() => s.imprimerEtiquettes(nonRangees.map((l) => ({ num: l.numero, titre: l.titre })))}>{tr('sm.imprimer', { n: nonRangees.length })}</Bouton>
    : null;
  return (
    <div className="sr-ecran sm-ecran" data-sr-ecran="" data-sr-vue={vue} data-sm-vue={zoom && vue === 'meubles' ? 'zoom' : vue}>
      {s.blocs.inventaire}{s.blocs.annuel}
      <div className="sm-tete">
        <h1 className="sm-titre sr-titre">{tr('nav.garage')}</h1>
        <span className="sm-tete-gestes">
        {/* LE geste de l'écran, compact sur la ligne du titre (comme Annonces) : visible au premier écran, même à 375 px
            en « Très grand », sans repousser la liste ; il reste posé pendant la séance (rien ne bouge sous la feuille). */}
        {nPlein ? <Bouton variante="teinte" icone={<Icon name="box" size={18}/>} attrs={{ 'data-sr-lancer': nPlein, 'aria-label': tr('sr.lancer', { n: nPlein, mot: nPlein > 1 ? mots.noms : mots.nom }) }}
          onClick={() => lancer(aRangerCles)}>{tr('sr.lancerCourt', { n: nPlein })}</Bouton> : null}
        <BoutonIcone libelle={tr('sr.menu.ouvrir')} icone={<Icon name="more" size={22}/>} onClick={() => setPlus(true)} attrs={{ 'data-sr-plus-ouvrir': '', 'data-sr-etats': s.etats.length || undefined }}/>
        </span>
      </div>
      {/* (21 nov., style Vintex) « À écrire sur tes cartons » : SOUS le titre de l'écran (avant, au-dessus de lui). */}
      {s.aEcrire || null}
      {s.filtres ? <div className="v2-sous-titre sr-sous-titre"><MenuPlateforme id="stock" Icon={Icon} Retour={s.Retour} libelle={s.filtres.libelle} sous={s.filtres.sous}>{s.filtres.corps}</MenuPlateforme></div> : null}
      <ARegler onglet="stock" Icon={Icon}/>
      {s.blocs.horsLigne}

      {/* « Où est… » : le champ (photo et voix dedans). */}
      <div className="sr-cherche-ligne">
        <div className="sr-cherche" data-sr-recherche="">
          <span className="sr-cherche-ic" aria-hidden="true"><Icon name="search" size={18}/></span>
          <input ref={s.chercheRef} className="sr-champ" value={s.q} onChange={(e) => s.setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off"
            placeholder={tr('sr.cherche.place')} aria-label={tr('stock.retrouverArticleDans')} data-sr-cherche=""
            onKeyDown={(e) => { if (e.key === 'Escape') s.setQ(''); if (e.key === 'Enter' && un && s.ouEst(un)) { e.preventDefault(); voir(un); } }}/>
          <span className="sr-cherche-mic">{s.q ? <button type="button" className="sr-rond is-petit" aria-label={tr('reglages.recherche.effacer')} onClick={() => s.setQ('')}><Icon name="close" size={18}/></button>
            : <>{s.dicteeOk ? <Mic nu titre={motsVendeur().nom === 'paire' ? tr('stock.chercherVoixNumero') : tr('stock.chercherVoixNumero2')} onText={(t) => s.setQ(requeteDeLaVoix(t).requete)}/> : null}
              <button type="button" className="sr-rond is-petit" aria-label={tr('stock.trouverPhoto')} title={tr('stock.trouverPhoto')} data-sr-photo="" onClick={s.ouvrirPhoto}><Icon name="camera" size={20}/></button></>}</span>
        </div>
      </div>

      {!chercheVide ? (
        <div className="sm-bloc" data-stock-resultats={s.resultats.length}>
          {un ? <Groupe><div className="sm-carte-pad"><Reponse s={s} f={un} onVoir={() => voir(un)} onDeplacer={() => lancer([s.cleDe(un)], true)} onRanger={() => rangerA(s.cleDe(un))}/></div></Groupe> : null}
          {!un && s.resultats.length === 0 ? <p className="sm-sans" data-stock-rien="">{s.qEstNum ? tr('sr.cherche.rienNum', { num: s.q.trim() }) : tr('sr.cherche.rien', { q: s.q.trim() })}</p> : null}
          {!un && s.resultats.length > 1 ? (
            <Groupe>
              {s.resultats.slice(0, 30).map((f) => { const ou = s.ouEst(f); return (
                <Rangee key={f.id} vignette={<Vignette src={f.photo || ''} alt=""/>} titre={f.title || '—'} lignes={2} plaque={<Plaque numero={f.numero}/>}
                  sousTitre={ou ? s.placeEnMots(ou) : tr('sr.reponse.pasRangee')} fin="chevron" onClick={() => setChoisi(s.cleDe(f))} attrs={{ 'data-stock-res': s.cleDe(f) }}/>); })}
            </Groupe>) : null}
        </div>
      ) : null}
      {chercheVide && s.cibles.length ? (
        <Groupe titre={tr('stock.allerChercher')} action={<Bouton variante="texte" onClick={() => s.setCibles([])}>{tr('creerVinted.fermer')}</Bouton>} attrs={{ 'data-stock-cibles': s.cibles.length }}>
          {s.cibles.map((k) => { const f = s.ficheDe(k); const ou = f && s.ouEst(f); return (
            <Rangee key={k} vignette={<Vignette src={(f && f.photo) || ''} alt=""/>} titre={(f && f.title) || ''} plaque={<Plaque numero={f ? f.numero : k}/>}
              sousTitre={ou ? s.placeEnMots(ou) : tr('sr.reponse.pasRangee')} onClick={() => { if (f && ou) voir(f); }} attrs={{ 'data-aller-chercher': k }}/>); })}
        </Groupe>) : null}

      {chercheVide ? <>
        {/* (20 nov., lot arrivee-scan) Les ACHATS arrivés (pas encore d'article) : leur N° et leur case, un toucher. */}
        <ArrivesARanger Icon={s.Icon}/>
        {/* « À RANGER · N » : la liste d'abord, « Ranger » au bout de chaque rangée. */}
        {/* Pendant la lecture, le squelette a la FORME de « À ranger » (5 rangées) : la liste arrive à sa place, les meubles
            ne sautent pas (mesuré au banc stock-rangement : CLS 0,31 quand la liste arrivait sur une ligne de texte). */}
        {s.nombres.enLigne == null && s.nombres.attente ? <div data-stock-actuelles={s.nombres.etat} aria-busy="true" aria-label={tr('stock.jeLisAnnonces')}><Attente forme="rangees" n={A_RANGER_MONTRES} vignette={56} titre/></div> : null}
        {s.nombres.enLigne == null && !s.nombres.attente ? <p className="sm-sans" data-stock-actuelles={s.nombres.etat}>{tr('sr.pasLu')}</p> : null}
        {nonRangees.length ? (
          <Groupe titre={tr('sm.aRanger', { n: nombre(nonRangees.length) })} action={imprimer} attrs={{ 'data-sr-groupe': 'aranger', 'data-sm-a-ranger': nonRangees.length }}>
            {aRangerVus.map(ligneARanger)}
            {aRangerVus.map(dansFiche)}
          </Groupe>) : null}
        {nonRangees.length > aRangerVus.length ? <div className="sm-gestes"><Bouton variante="texte" attrs={{ 'data-sm-a-ranger-tous': '' }} onClick={() => { if (tousARanger) setMax((x) => x + PAR_PAGE); else setTousARanger(true); }}>{tr('sm.voirAutres', { n: nombre(Math.min(tousARanger ? PAR_PAGE : 9999, nonRangees.length - aRangerVus.length)) })}</Bouton></div> : null}

        {/* Meubles · Articles : les deux façons de regarder le stock. (23 nov., revue UX P2) Un nombre partiel s'écrit « 36+ » (au moins 36),
            plus « ≥ 36 » que personne ne lisait. */}
        <div className="sm-bloc" data-sr-segment={vue}>
          <Segmente libelle={tr('sr.seg.label')} valeur={vue} onChange={(v) => { setVue(v); setZoom(null); }}
            options={[{ cle: 'meubles', libelle: tr('sm.seg.meubles'), n: s.meubles.length ? nombre(s.meubles.length) : null },
              { cle: 'articles', libelle: mots.Noms, n: s.nombres.enLigne != null ? (s.nombres.auMoins ? tr('ru.stock.auMoins', { n: nombre(s.nombres.enLigne) }) : nombre(s.nombres.enLigne)) : null }]}/>
        </div>
        {vue === 'meubles' ? <Meubles s={s} zoom={zoom} setZoom={(z) => { setZoom(z); setVise(null); }} vise={vise} ouvrirAssistant={() => setAssistant(true)}/> : <>
          {rangees.length ? (
            <Groupe titre={tr('sm.dansCase', { n: nombre(rangees.length) })} attrs={{ 'data-sr-groupe': 'rangees', 'data-sr-liste': lignes.length, 'data-stock-actuelles': s.nombres.etat }}>
              {rangeesVues.map(ligneRangee)}
              {rangeesVues.map(dansFiche)}
            </Groupe>) : null}
          {rangees.length > max ? <div className="sm-gestes"><Bouton variante="texte" attrs={{ 'data-sr-liste-plus': '' }} onClick={() => setMax((x) => x + PAR_PAGE)}>{tr('sr.liste.plus', { n: nombre(Math.min(PAR_PAGE, rangees.length - max)) })}</Bouton></div> : null}
          {s.blocs.aFaire}
          {s.blocs.importees}{s.blocs.aPart}{s.blocs.ecartes}
          {s.blocs.plus}
        </>}
      </> : null}
      {s.blocs.modale}

      <FeuillePlus s={s} ouverte={plus} fermer={() => setPlus(false)} ouvrirAssistant={() => { setPlus(false); setTimeout(() => setAssistant(true), 320); }}/>
      {s.assistant ? <AssistantRangement ouverte={assistant} fermer={() => setAssistant(false)} Icon={Icon} langue={langueCourante()} {...s.assistant}/> : null}
      <Seance key={seance ? seance.id : 'aucune'} s={s} seance={seance} ouverte={seanceOuverte && !!seance} fermer={fermerSeance}/>
    </div>
  );
}
