// ════════════════════════════════════════════════════════════════════════════
//  VENTES, NOUVEAU DESIGN — phase 2 (17 nov.). Julien : « J'aime pas la disposition de tout, tu peux tout revoir ».
//  Allumé seulement (`vrm_design_v2`) ; éteint, rien de ce fichier n'est rendu.
//
//  L'écran, de haut en bas (le grand titre et le plein « Imprimer N bordereaux » vivent sur la ligne du titre, posés par
//  la coque) :
//    · UN segmenté : À envoyer · En route · Toutes (les MÊMES onglets qu'avant, `onOngletColis`) ;
//    · le chiffre d'affiche « N colis à envoyer » (le nombre PUBLIÉ, `vrm_colis_aposter`, « — » tant qu'il n'est pas lu)
//      et, dessous, l'écart NOMMÉ (« 1 sans bordereau · 3 imprimés, à déposer ») ;
//    · la recherche, le scanner DANS le champ, et « ⋯ » (les outils d'hier : choisir, papier, préparer, déposer…) ;
//    · les groupes par échéance, chacun dit UNE fois dans son en-tête (« Avant demain soir », « Cette semaine »,
//      « Date estimée »…), puis les rangées A (photo, titre, « N° · T. · acheteur », prix à droite).
//  Glisser à gauche : Imprimer · Plus. Toucher : la fiche de la paire (les `data-fl-*` de la carte d'hier, qui reste
//  MONTÉE, cachée, avec tous ses gestes — `DansFiche`).
//  Une rangée imprimée joue le mouvement « fait » (coche, elle glisse et se replie en 220 ms) et rejoint « Imprimés, à
//  déposer » ; le plein descend d'un cran (son nombre vient du lot, inchangé).
//  AUCUNE règle ici : groupes, N°, échéances, « prêt », « imprimé » sont calculés par l'écran (App.jsx) avec ses
//  règles d'hier (`avantDemainColis`, `e.lim`, `pdf`, `bordsPrinted`). Ce fichier range et dessine.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from '../i18n/index.js';
import LigneAnnonce from './LigneAnnonce.jsx';
import { ChiffreAffiche, RangeeFaite, SqueletteRangees } from './Signature.jsx';
import './design-v2.css';

// L'ordre des groupes d'« À envoyer » (le plus pressé d'abord ; ce qui est imprimé, à la fin).
export const GROUPES_ENVOYER = ['presse', 'semaine', 'plusTard', 'estimee', 'sansDate', 'imprimes'];
// L'ordre des groupes d'« En route » (ce qui peut demander un geste d'abord).
export const GROUPES_ROUTE = ['retour', 'coche', 'relais', 'route', 'livre'];

// Le chiffre d'affiche : celui de la signature (src/designV2/Signature.jsx), « N colis à envoyer », l'écart nommé dessous.
export function AfficheVentes({ n, mot, ecart = '', auMoins = '', attrs = {} }) {
  return <ChiffreAffiche n={n} mot={auMoins && n != null ? auMoins + ' · ' + mot : mot} sous={ecart} attrs={attrs}/>;
}

// La rangée recherche : le champ (le scanner dedans, passé par l'écran) et « ⋯ ».
export function RechercheVentes({ champ, plus }) {
  return <div className="v2v-recherche" data-v2v-recherche="">{champ}{plus}</div>;
}

// Le mouvement « fait » : une rangée qui vient d'être faite reste 260 ms à sa place, coche posée, puis se replie.
// `lignes` : [{ cle, fait }] ; rend l'ensemble des clés qui viennent de passer à « fait » (encore à leur place).
export function usePartants(lignes) {
  const avant = React.useRef(null);
  const minuteurs = React.useRef(new Set());
  const [partants, setPartants] = React.useState(() => new Map());
  // Les minuteurs ne sont arrêtés qu'au démontage : un nouveau rendu (il y en a un tout de suite) ne doit pas les annuler.
  React.useEffect(() => () => { for (const t of minuteurs.current) clearTimeout(t); minuteurs.current.clear(); }, []);
  React.useEffect(() => {
    const maintenant = new Map(lignes.map((l) => [l.cle, { fait: !!l.fait, groupe: l.groupe }]));
    const prec = avant.current; avant.current = maintenant;
    if (!prec) return;
    const neufs = lignes.filter((l) => l.fait && prec.get(l.cle) && prec.get(l.cle).fait === false);
    if (!neufs.length) return;
    setPartants((m) => { const x = new Map(m); for (const l of neufs) x.set(l.cle, { ...l, groupeAvant: prec.get(l.cle).groupe }); return x; });
    const reduit = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    const t = setTimeout(() => { minuteurs.current.delete(t); setPartants((m) => { const x = new Map(m); for (const l of neufs) x.delete(l.cle); return x; }); }, reduit ? 200 : 520);
    minuteurs.current.add(t);
  });
  return partants;
}

// La rangée qui vient d'être faite : montée « pas faite », elle passe « faite » à l'image suivante (le mouvement de la
// signature, `RangeeFaite` : coche, glisse, se replie en 220 ms) ; ensuite la liste la range dans « Imprimés, à déposer ».
function Partante({ children }) {
  const [f, setF] = React.useState(false);
  // Un minuteur court plutôt qu'une image d'animation : il part aussi quand le navigateur retient ses images (onglet occupé).
  React.useEffect(() => { const t = setTimeout(() => setF(true), 20); return () => clearTimeout(t); }, []);
  return <RangeeFaite fait={f}>{children}</RangeeFaite>;
}

// Une rangée de colis : la rangée A de la liste (LigneAnnonce), ses gestes de glisser à soi.
function LigneColis({ l, Photo, Icon, LigneGlissable, partant = false }) {
  const gestes = [
    l.imprimer ? { cle: 'imprimer', libelle: tr('v2v.imprimer'), icone: <Icon name="printer" size={20}/>, faire: l.imprimer, data: { 'data-v2l-glisse': 'imprimer' } } : null,
    l.choisir ? { cle: 'choisir', libelle: tr('v2v.choisir'), icone: <Icon name="link" size={20}/>, faire: l.choisir, data: { 'data-v2l-glisse': 'choisir' } } : null,
    l.plus ? { cle: 'plus', libelle: tr('v2.l.plus'), icone: <Icon name="more" size={20}/>, faire: l.plus, data: { 'data-v2l-glisse': 'plus' } } : null,
  ].filter(Boolean);
  const ligne = (
    <LigneAnnonce variante="A" cle={'v2v:' + l.cle} attrs={{ ...l.attrs, 'data-v2v-ligne': l.cle, 'data-v2v-groupe': l.groupe, 'data-v2v-fait': partant ? 'part' : undefined }}
      photo={l.photo || null} Photo={Photo} Icon={Icon} titre={l.titre} num={l.num} double={!!l.double} prix={l.prix}
      sous={l.sous} sousAmbre={l.sousAmbre} l3={l.l3} logo={l.logo} gestes={gestes} LigneGlissable={partant ? null : LigneGlissable}/>
  );
  return partant ? <Partante>{ligne}</Partante> : ligne;
}

// La liste groupée : un en-tête par groupe (son nom et son nombre, UNE fois), les rangées dessous, sur une carte.
export function ListeColis({ lignes, ordre, noms, Photo, Icon, LigneGlissable, vide = null, id = 'envoyer', partants = null }) {
  const parGroupe = new Map(ordre.map((g) => [g, []]));
  for (const l of lignes) { const p = partants && partants.get(l.cle); const g = p ? p.groupeAvant : l.groupe; if (parGroupe.has(g)) parGroupe.get(g).push(p ? { ...l, groupe: g, _part: true } : l); }
  const groupes = ordre.map((g) => [g, parGroupe.get(g)]).filter(([, ls]) => ls.length);
  if (!groupes.length) return vide;
  return (
    <div className="v2v-liste" data-v2v-liste={id} role="list">
      {groupes.map(([g, ls]) => {
        const n = ls.filter((l) => !l._part).length;
        return (
          <React.Fragment key={g}>
            <h3 className="v2-ann-groupe v2v-groupe" data-v2v-groupe-tete={g} data-v2v-groupe-n={n}>
              <span className={noms[g] && noms[g].ambre ? 'v2v-groupe-ambre' : undefined}>{noms[g] ? noms[g].nom : g}</span>
              <span className="v2-ann-groupe-n">{nombre(n)}</span>
            </h3>
            {ls.map((l) => <LigneColis key={l.cle + (l._part ? ':p' : '')} l={l} Photo={Photo} Icon={Icon} LigneGlissable={LigneGlissable} partant={!!l._part}/>)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// La recherche de la liste : le N° (« 124 », « n°124 », « B188 »), le titre, la taille, l'acheteur, le transporteur — sans accents
// ni casse. Une liste, jamais un rapprochement : ce qui est montré est ce qui CONTIENT le texte tapé.
const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filtrerLignes(lignes, q) {
  const r = sansAccents(q).replace(/^n°\s*/, '').trim();
  if (!r) return lignes;
  return lignes.filter((l) => sansAccents([l.num ? 'n°' + l.num + ' ' + l.num : '', l.titreComplet || l.titre, ...(l.sous || []), ...((l.l3 || []).map((x) => x.texte)), l.prix].join(' ')).includes(r));
}

function Vide({ texte, calme = false, Icon }) {
  return <div className={'v2v-vide' + (calme ? ' is-calme' : '')} data-v2v-vide="">{calme && Icon ? <span className="v2v-vide-ic" aria-hidden="true"><Icon name="check" size={22}/></span> : null}<p>{texte}</p></div>;
}

// « À envoyer » : groupes par échéance, le mouvement « fait » à l'impression, la recherche, ce qui n'est pas lu dit dessous.
export function ListeEnvoyer({ lignes, q = '', lu = true, erreur = '', pasLus = null, retours = null, Photo, Icon, LigneGlissable }) {
  const partants = usePartants(lignes);
  const vues = filtrerLignes(lignes, q);
  const nLitiges = lignes.filter((l) => l.litige).length;
  const noms = {
    presse: { nom: tr('v2v.g.presse'), ambre: true }, semaine: { nom: tr('v2v.g.semaine') }, plusTard: { nom: tr('v2v.g.plusTard') },
    estimee: { nom: tr('v2v.g.estimee') }, sansDate: { nom: tr('v2v.g.sansDate') }, imprimes: { nom: tr('v2v.g.imprimes') },
  };
  if (erreur && !lignes.length) return <div className="v2v-corps" data-v2v-corps="envoyer" data-v2v-n="0"><Vide texte={erreur}/></div>;
  if (!lu && !lignes.length) return <div className="v2v-corps" data-v2v-corps="envoyer" data-v2v-n="0"><SqueletteRangees variante="A" n={6} label={tr('v2v.vide.lecture')}/></div>;
  const vide = !lu ? <SqueletteRangees variante="A" n={6} label={tr('v2v.vide.lecture')}/> : q.trim() ? <Vide texte={tr('v2v.vide.recherche', { q: q.trim() })}/> : <Vide texte={tr('v2v.vide.envoyer')} calme Icon={Icon}/>;
  return (
    <div className="v2v-corps" data-v2v-corps="envoyer" data-v2v-n={lignes.length}>
      <ListeColis lignes={vues} ordre={GROUPES_ENVOYER} noms={noms} Photo={Photo} Icon={Icon} LigneGlissable={LigneGlissable} vide={vide} id="envoyer" partants={partants}/>
      {retours}
      {nLitiges ? <p className="v2v-note" data-v2v-litiges={nLitiges}>{tr('v2v.litiges', { n: nLitiges })}</p> : null}
      {pasLus ? <div className="v2v-note">{pasLus}</div> : null}
    </div>
  );
}

// « En route » : ce qui peut demander un geste d'abord (retours, déposés pas encore vus partir), puis au relais, en route, livrés.
export function ListeRoute({ lignes, q = '', avant = null, Photo, Icon, LigneGlissable }) {
  const vues = filtrerLignes(lignes, q);
  const noms = { retour: { nom: tr('v2v.g.retour'), ambre: true }, coche: { nom: tr('v2v.g.coche') }, relais: { nom: tr('v2v.g.relais') }, route: { nom: tr('v2v.g.route') }, livre: { nom: tr('v2v.g.livre') } };
  const vide = q.trim() ? <Vide texte={tr('v2v.vide.recherche', { q: q.trim() })}/> : <Vide texte={tr('v2v.vide.route')}/>;
  return (
    <div className="v2v-corps" data-v2v-corps="route" data-v2v-n={lignes.length}>
      {avant}
      <ListeColis lignes={vues} ordre={GROUPES_ROUTE} noms={noms} Photo={Photo} Icon={Icon} LigneGlissable={LigneGlissable} vide={vide} id="route"/>
    </div>
  );
}
