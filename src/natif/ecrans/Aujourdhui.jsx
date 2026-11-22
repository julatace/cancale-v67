// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI — « VRM natif » (docs/design/NATIF.md §4), 19 nov. Décisions de Julien, mot pour mot :
//    « le visuel de l'app doit être absolument parfait » ; « tout ça ne sert à rien, ça doit être rangé dans les
//    onglets dédiés justement à ça […] il y a d'autres choses plus intéressantes pour cet onglet » ; « l'outil doit
//    être pratique, pas chiant » ; « je veux quelque chose de drastique, nouveau, totalement différent ».
//  ⇒ PAS DE LISTE « À FAIRE » ICI : ses groupes sont PUBLIÉS (src/designV2/aRegler.js) et se lisent en tête de LEUR
//    onglet (« À régler »). Ne pas la remettre sur cet écran.
//  De haut en bas — ce qu'il regarde chaque matin, rien qui le gronde :
//    1+2. LES CHIFFRES (19 nov., « plus de stats […] le CA, le bénéfice ») : Jour · Semaine · Mois — le CA vendu en grand
//       et son écart nommé avec la période d'avant, puis Bénéfice · Ventes · Panier moyen (« — » si pas su, jamais 0) ;
//    3. « À envoyer » : le nombre, des vignettes nettes (chacune SA plaque, « +N » pour le reste) ; LE plein
//       « Imprimer N bordereaux » est celui de la page (collé en bas) ;
//    4. « À retirer » : le point sur une ligne, le code en grand ;
//    5. « Dernières ventes » (5). (« Argent à venir », « Reçu », les 7 barres : dans Argent.)
//  Au plus UNE alerte (une date limite LUE qui tombe aujourd'hui ou demain), dite DANS le groupe qu'elle concerne.
//  Écran natif : il COMPOSE les composants de src/natif/ — ni style en ligne, ni classe de mise en page, ni couleur.
//  AUCUNE règle ici : tout arrive calculé (src/aujourdhui/modele.js, les cartes de Ma journée dans src/App.jsx).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { LogoSite } from '../LogoSite.jsx';   // (20 nov. soir) le logo du site de chaque colis
import { tr, nombre, localeCourante } from '../../i18n/index.js';
import { Page, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Vide, Segmente, Colonnes, Colonne, Carte, Tuiles, Tuile, Pastille, Faits, Fait, Feuille, Courbe, Progression, Champ, ListeOrdonnee, Editable, Toast, useOrdinateur } from '../index.js';
import { CARTES_AUJOURDHUI, CARTES_DEFAUT, cartesChoisies } from '../../aujourdhui/modele.js';
import { publierARegler } from '../../designV2/aRegler.js';
import './journee.css';   // (21 nov.) « Colis » à hauteur fixe

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
// « 1 107 € » ⇒ [« 1 107 », « € »] : l'unité est posée à côté du chiffre par <Affiche>.
const coupe = (t) => { const m = /^(.*?)[\s  ]*€$/.exec(String(t)); return m ? [m[1], '€'] : [String(t), '']; };
// « il y a 3 h » dans la langue (Intl) ; pas de date ⇒ rien.
export function ilYaCourt(ts, maintenant = Date.now()) {
  if (!Number.isFinite(Number(ts))) return '';
  const min = Math.max(0, Math.round((maintenant - Number(ts)) / 60000));
  try {
    const f = new Intl.RelativeTimeFormat(localeCourante(), { numeric: 'always', style: 'short' });
    if (min < 60) return f.format(-Math.max(1, min), 'minute');
    if (min < 24 * 60 && new Date(Number(ts)).toDateString() === new Date(maintenant).toDateString()) return f.format(-Math.round(min / 60), 'hour');
    // (reprise, captures de Julien : « il y a 31 h ») Au-delà du jour même : en JOURS DU CALENDRIER (« hier », « il y a 3 j »).
    const j0 = new Date(maintenant); j0.setHours(0, 0, 0, 0); const j1 = new Date(Number(ts)); j1.setHours(0, 0, 0, 0);
    const j = Math.max(1, Math.round((j0 - j1) / 86400000));
    return new Intl.RelativeTimeFormat(localeCourante(), { numeric: 'auto', style: 'short' }).format(-j, 'day');
  } catch (_) { return ''; }
}

// LES CHIFFRES (19 nov., Julien : « je veux peut-être plus de stats dans l'onglet Ma journée, par exemple le CA, le
// bénéfice etc. »). Un segmenté Jour · Semaine · Mois, puis : le CA vendu en grand (« au moins » si un prix n'est pas lu)
// et son écart NOMMÉ avec la période d'avant au même moment ; Bénéfice · Ventes · Panier moyen. Tout vient de
// `chiffres.stats` (src/aujourdhui/modele.js `statsPeriodes` : les mêmes `valeurChiffre` que l'écran Argent) ; un chiffre
// pas su = « — » et sa raison, jamais 0. Toucher un chiffre ouvre Argent sur la période.
// `chiffres` : { etat: 'encours' | 'passu' | 'lu', raison, stats: { jour|semaine|mois: { vendu, ventes, panier, benefice,
// ecart } }, mois: { nom }, moisAvant, montant, ouvrirPeriode(p) }.
// La boîte a la MÊME forme dans les trois états : rien ne bouge quand le chiffre arrive.
const PERIODES = ['jour', 'semaine', 'mois'];
// (21 nov., lot journee-stats) Ma journée montre Aujourd'hui · Ce mois ; la semaine et les fenêtres 7 · 30 · 90 j vivent dans Statistiques.
const PERIODES_JOURNEE = ['jour', 'mois'];
const NOTE = { aucune: 'v2.stats.aucune', partiel: 'v2.stats.pasTout' };
function Chiffres({ chiffres, p, setP, objectif = null, onSaisirPrix = null, onVentes = null }) {
  const { etat = 'encours', raison = '', stats = null, mois = null, moisAvant = '', montant = (x) => String(x), ouvrirPeriode = null } = chiffres;
  const S = etat === 'lu' && stats ? stats[p] : null;
  const V = S ? S.vendu : null;
  const [n, u] = V && V.valeur != null ? coupe(montant(V.valeur)) : [null, ''];
  const quand = tr('v2.stats.vendus.' + p, { mois: mois && mois.nom ? mois.nom.toLowerCase() : '' });
  const libelle = etat === 'encours' ? tr('v2.jour.lecture') : !V || V.valeur == null ? (raison || (V && V.note) || tr('v2.jour.pasSu'))
    : (V.partiel ? tr('journee.moins') + ' · ' : '') + quand;
  const signe = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x) + ' %';
  const ecart = S && S.ecart != null ? tr('v2.stats.ecart.' + p, { s: signe(S.ecart), mois: moisAvant }) : '';
  const ouvrir = ouvrirPeriode ? () => ouvrirPeriode(p) : null;
  const note = (x) => (!x ? '' : NOTE[x.note] ? tr(NOTE[x.note]) : (x.note || ''));
  // (21 nov., Julien : « bénéfice dans Ma journée — brut et net du mois, et d'aujourd'hui, les mêmes chiffres que
  // Comptabilité ») DEUX tuiles, chacune de SA règle (src/aujourdhui/modele.js `statsPeriodes` : `brut`, `net`).
  const Br = S ? S.brut : null, Nt = S ? S.net : null;
  const detailBr = !Br ? '' : Br.valeur == null ? '' : Br.couverture ? tr('v2.stats.surVentes', { c: Br.couverture }) : '';
  const detailNt = !Nt ? '' : Nt.valeur == null ? '' : Nt.duJour ? tr('v2.stats.netDuJour') : Nt.auMois ? tr('v2.stats.netAuMois') : Nt.avantDepenses ? tr('v2.stats.netAvantDepenses') : tr('v2.stats.netComme');
  // (21 nov., captures de Julien : « Bénéfice brut — pas calculé ») UNE TUILE SANS VALEUR N'EXISTE PAS (audit du 20 nov.,
  // R5) : un bénéfice pas su devient LA PORTE qui le complète, en accent — « Compléter » (des prix d'achat manquent : la
  // saisie en série) ou « Ouvrir Ventes » (pas encore calculé : l'écran Ventes le calcule). « Aucune vente » reste dit.
  const benef = (cle, X, lib, detail) => {
    const attrs = { 'data-v2-stat': cle, 'data-benef-notion': cle === 'net' ? 'benefice' : 'brut', 'data-benef-valeur': X ? cents(X.valeur) : '' };
    if (X && X.valeur != null) return <Tuile libelle={lib} valeur={coupe(montant(X.valeur))[0]} unite={coupe(montant(X.valeur))[1]} detail={detail} onClick={ouvrir} attrs={attrs}/>;
    const rien = !!S && S.ventes.valeur === 0;
    const achats = !!X && (X.raison === 'achats' || /achat/.test(String(X.note || '')));
    if (!S || rien) return <Tuile libelle={lib} valeur={null} detail={!S ? (etat === 'encours' ? tr('v2.jour.lecture') : '') : tr('v2.stats.aucune')} attrs={attrs}/>;
    const porte = achats ? onSaisirPrix : onVentes;
    return <Tuile libelle={lib} valeur={achats ? tr('v2.ben.completer') : tr('v2.ben.ouvrirVentes')} detail={achats ? tr('v2.ben.prixManquent') : tr('v2.ben.seCalcule')} onClick={porte}
      attrs={{ ...attrs, 'data-v2-porte': achats ? 'prix' : 'ventes' }}/>;
  };
  // Ce que le banc lit (les nombres, jamais un libellé) : chaque période, chaque chiffre, en centimes ; « » = pas su.
  const resume = !stats || etat !== 'lu' ? '' : JSON.stringify(Object.fromEntries(PERIODES.map((k) => { const x = stats[k]; return [k, {
    vendu: cents(x.vendu.valeur), vp: x.vendu.partiel ? 1 : 0, ventes: x.ventes.valeur == null ? '' : String(x.ventes.valeur), np: x.ventes.partiel ? 1 : 0, benefice: cents(x.benefice.valeur),
    brut: x.brut ? cents(x.brut.valeur) : '', brutCouv: x.brut ? x.brut.couverture || '' : '', net: x.net ? cents(x.net.valeur) : '',
    bp: x.benefice.partiel ? 1 : 0, couverture: x.benefice.couverture || '', panier: cents(x.panier.valeur), ecart: x.ecart == null ? '' : String(x.ecart) }]; })));
  // La MÊME hauteur en lecture, lu, pas su, et d'une période à l'autre : la ligne de l'écart et le détail de chaque fait
  // sont toujours là (une espace insécable quand il n'y a rien à dire) — rien ne saute quand le chiffre arrive.
  const detailV = !V ? '' : V.valeur == null ? (raison || V.note || '') : [V.partiel ? tr('journee.moins') : '', ecart].filter(Boolean).join(' · ');
  // (19 nov., « entre Vintex et celui-là ») QUATRE TUILES à filet : CA vendu · Bénéfice · Ventes · Panier moyen, l'écart en
  // petit sous le CA ; le segmenté Jour · Semaine · Mois au-dessus (à droite à l'ordinateur). Même hauteur dans tous les états.
  return (
    <Tuiles titre={tr('v2.stats.titre')} pied={objectif && p === 'mois' ? <ObjectifLigne objectif={objectif} montant={montant}/> : null} action={<Segmente libelle={tr('v2.stats.periode')} valeur={p} onChange={setP} options={PERIODES_JOURNEE.map((k) => ({ cle: k, libelle: tr('v2.stats.' + k) }))}/>}
      attrs={{ 'data-v2-bloc': 'chiffres', 'data-v2-chiffres': etat, 'data-v2-periode': p, 'data-v2-stats': resume, 'aria-busy': etat === 'encours' ? 'true' : undefined, 'aria-label': libelle,
        'data-v2-jour-vendu': etat === 'lu' && stats ? cents(stats.jour.vendu.valeur) : '', 'data-v2-jour-ventes': etat === 'lu' && stats && stats.jour.ventes.valeur != null ? String(stats.jour.ventes.valeur) : '' }}>
      <Tuile libelle={tr('v2.stats.ca')} valeur={n} unite={u} detail={etat === 'encours' ? tr('v2.jour.lecture') : detailV} onClick={ouvrir} attrs={{ 'data-v2-stat': 'vendu' }}/>
      <Tuile libelle={tr('v2.stats.ventes')} valeur={S && S.ventes.valeur != null ? nombre(S.ventes.valeur) : null}
        detail={S && S.ventes.valeur == null ? note(S.ventes) : (S && S.ventes.partiel ? tr('journee.moins') : '')} onClick={ouvrir} attrs={{ 'data-v2-stat': 'ventes' }}/>
      {benef('brut', Br, tr('v2.stats.beneficeBrut'), detailBr)}
      {benef('net', Nt, tr('v2.stats.beneficeNet'), detailNt)}
    </Tuiles>
  );
}

// L'OBJECTIF DU MOIS (19 nov.) : la règle de la carte des chiffres (src/objectifMois.js `progressionObjectif`,
// `resteObjectif`) — « 1 840 € / 3 000 € · 61 % · il reste 11 j ». Pas d'objectif ⇒ un lien discret pour le fixer.
// `objectif` : { etat: 'aucun' | 'encours' | 'passu' | 'lu', type, cible, valeur, pct, partiel, atteint, jours, raison, ouvrir }.
function ObjectifLigne({ objectif: o, montant }) {
  if (o.etat === 'aucun') return <Bouton variante="texte" onClick={o.ouvrir} attrs={{ 'data-v2-objectif': 'aucun' }}>{tr('v2.obj.fixer')}</Bouton>;
  const f = (x) => (o.type === 'ventes' ? nombre(x) : montant(x));
  const texte = tr('v2.obj.texte', { v: o.valeur == null ? '—' : f(o.valeur), c: f(o.cible) });
  const detail = o.etat !== 'lu' || o.pct == null ? (o.raison || tr('v2.jour.lecture'))
    : o.atteint ? tr('v2.obj.atteint', { pct: o.pct }) : (o.partiel ? tr('journee.moins') + ' ' : '') + tr('v2.obj.detail', { pct: o.pct, j: o.jours, n: o.jours });
  return <Progression pct={o.etat === 'lu' ? o.pct : null} texte={texte} detail={detail} onClick={o.ouvrir} attrs={{ 'data-v2-objectif': o.etat, 'data-v2-objectif-pct': o.pct == null ? '' : String(o.pct) }}/>;
}

// `pret` : les lectures dont dépend l'écran sont arrivées (à envoyer ET à retirer). Avant : l'affiche et le mois à leur
// taille, RIEN d'autre — puis les groupes arrivent d'un coup, à leur place (17 nov., Julien : « quand ça charge tout bouge
// bizarrement » : aucun bloc qui apparaît puis s'en va, aucun ordre qui change).
export default function Aujourdhui({ titre, enDirect = null, pret: pretLu = true, affiche, colis = [], retraits = null, groupes = [], plein = null, Photo = null, Icon, onColis, onRetraits,
  onScanner = null, chiffres = null, alerte = null, ventes = null, aVenir = null, onVentes = null,
  objectif = null, courbe = null, comptes = null, capte = null, vrm = null, cartes = null, onMessages = null, onJournal = null,
  stats2 = null, onDorment = null, onAVenir = null, onNav = null, onSaisirPrix = null, haut = null, aRepublier = null }) {   // (21 nov., prio-recherche) aRepublier : { n, jours, ouvrir } | null   // (21 nov., ux-reglages) haut : « Bien démarrer », en tête
  const ordinateur = useOrdinateur();
  const [modifier, setModifier] = React.useState(false);
  const [defait, setDefait] = React.useState(null);   // le choix d'avant « Remettre par défaut » (annulable 10 s)
  const [p, setP] = React.useState('jour');
  const [jour, setJour] = React.useState(null);
  const [perso, setPerso] = React.useState(false);
  const [objOuvert, setObjOuvert] = React.useState(false);
  const [saisie, setSaisie] = React.useState('');
  const [saisieKo, setSaisieKo] = React.useState(false);
  const choix = cartesChoisies(cartes ? cartes.brut : null);
  const montant = chiffres && chiffres.montant ? chiffres.montant : (x) => String(x);
  const obj = objectif ? { ...objectif, ouvrir: () => { setSaisie(objectif.cible ? String(objectif.cible) : ''); setSaisieKo(false); setObjOuvert(true); } } : null;
  // Prêt une fois, prêt pour de bon ; une lecture qui ne répond pas n'enferme pas l'écran (10 s, puis « — » là où ce n'est pas su).
  const dejaPret = React.useRef(false);
  const [delai, setDelai] = React.useState(false);
  React.useEffect(() => { if (pretLu) return undefined; const t = setTimeout(() => setDelai(true), 10000); return () => clearTimeout(t); }, [pretLu]);
  if (pretLu || delai) dejaPret.current = true;
  const pret = dejaPret.current;
  // ⚠️ « À FAIRE » QUITTE CET ÉCRAN : ses groupes sont PUBLIÉS pour leurs onglets, chacun avec son geste. Seulement une
  // fois les lectures arrivées ; des groupes absents (null) = la base ne répond pas : la publication d'avant reste.
  React.useEffect(() => { if (pret && pretLu && Array.isArray(groupes)) publierARegler(groupes); });
  const n = affiche && !affiche.pasSu ? affiche.n : null;
  const nRet = retraits && !retraits.pasSu ? retraits.n : null;
  const rien = pret && n === 0 && nRet === 0;
  const point = retraits && Array.isArray(retraits.points) ? retraits.points[0] : null;
  const lignesV = ventes && ventes.etat === 'lu' && Array.isArray(ventes.lignes) ? ventes.lignes.slice(0, 5) : [];
  // « Argent à venir » : seulement s'il est lu ET qu'il y en a (« 0 € à venir » n'apprend rien).
  const aVenirLu = !!aVenir && aVenir.valeur != null && aVenir.valeur > 0;
  const image = (src, taille) => (src && Photo ? <Photo className="n-vignette" data-n-taille={taille} src={src} alt="" width={taille} height={taille} loading="lazy" decoding="async"/> : <Vignette taille={taille} icone={<Icon name="cintre" size={22}/>}/>);
  // LES GROUPES, dans l'ORDRE DE LEUR ARRIVÉE : l'ordre voulu quand tout est lu ensemble ; un groupe lu plus tard se pose
  // à la fin, jamais au-dessus d'un autre (rien ne pousse ce que l'œil lit).

  // (19 nov., « entre Vintex et celui-là ») DES CARTES-TABLEAUX à filet : l'en-tête dans la carte (petites capitales
  // grises, le compte, une ligne d'état), des rangées denses (vignette 44, titre, « N° · transporteur », l'échéance en
  // pastille, le prix à droite). LE plein « Imprimer N bordereaux » est dans l'en-tête d'« À envoyer », compact.
  const VISIBLES = 4;
  const montres = colis.slice(0, Math.min(VISIBLES, n || 0));
  const resteEnv = Math.max(0, (n || 0) - montres.length);
  const pts = retraits && Array.isArray(retraits.points) ? retraits.points : [];
  const ptsMontres = pts.slice(0, 3), restePts = Math.max(0, (retraits && retraits.nPoints ? retraits.nPoints : pts.length) - ptsMontres.length);
  const alerteEnv = alerte && alerte.id === 'poster';
  const BLOCS = {
    // (21 nov., lot journee-stats — « ce qui est à faire en haut ») « COLIS » : DEUX rangées, toujours là, à leur
    // place dès l'ouverture (« — » le temps de la lecture, jamais un bloc qui apparaît puis s'en va) : à envoyer (le nombre,
    // l'échéance qui presse) et à retirer (le premier point et son code). LE plein « Imprimer N » est dans l'en-tête.
    colis: () => {
      const lecture = !pret;
      const envSous = lecture ? tr('v2.jour.lecture') : n == null ? tr('v2.jour.pasSu') : alerteEnv ? alerte.txt : n === 0 ? tr('v2.af.rienEnvoyer') : (affiche && affiche.sous) || '';
      const retSous = lecture ? tr('v2.jour.lecture') : nRet == null ? tr('v2.jour.pasSu') : nRet === 0 ? tr('v2.af.rienRetirer')
        : [point ? point.lieu || tr('v2.retirer.pointInconnu') : '', point && point.code ? point.code : '', pts.length > 1 || (retraits && retraits.nPoints > 1) ? tr('v2.retirer.points', { n: retraits.nPoints || pts.length }) : ''].filter(Boolean).join(' · ');
      return (
        <Carte titre={tr('v2.af.titre')} action={plein ? <Bouton variante="plein" onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n) }}>{tr('v2.imprimer', { n: plein.n })}</Bouton> : null}
          attrs={{ 'data-v2-bloc': 'colis', 'data-v2-cj': lecture ? '' : [n == null ? '' : n, nRet == null ? '' : nRet].join(','), 'aria-busy': lecture ? 'true' : undefined }}>
          <Rangee icone={<Icon name="truck" size={22}/>} titre={tr('v2.envoyer.titre')} sousTitre={envSous} ton={alerteEnv ? 'ambre' : undefined}
            valeur={lecture || n == null ? '—' : nombre(n)} valeurForte fin="chevron" onClick={() => onColis && onColis(null)} attrs={{ 'data-v2-cj-ligne': 'envoyer', 'data-v2-cj-n': n == null ? '' : String(n), 'data-v2-alerte': alerteEnv ? 'poster' : undefined }}/>
          <Rangee icone={<Icon name="pin" size={22}/>} titre={tr('v2.retirer.titre')} sousTitre={retSous} ton={retraits && retraits.premier && retraits.premier.ambre ? 'ambre' : undefined}
            valeur={lecture || nRet == null ? '—' : nombre(nRet)} valeurForte fin="chevron" onClick={onRetraits} attrs={{ 'data-v2-cj-ligne': 'retirer', 'data-v2-cj-n': nRet == null ? '' : String(nRet), 'data-v2-alerte': alerte && alerte.id === 'retirer' ? 'retirer' : undefined }}/>
          {/* (intégration 21 nov.) La prévision des points relais (ext. 5.411, relais-prevision) vivait dans la carte « À retirer » ;
              « Colis » la remplace par défaut (journee-stats) : la même rangée, la même source, ici — sinon elle disparaissait ; jamais deux fois. */}
          {!lecture && retraits && retraits.prevision && !choix.montrees.has('retirer') ? <Rangee icone={<Icon name="truck" size={22}/>} titre={retraits.prevision.phrase} lignes={2} fin="chevron" onClick={onRetraits}
            attrs={{ 'data-journee-prevision': retraits.prevision.quand }}/> : null}
          {/* (21 nov., prio-recherche) « N paires à republier en priorité › » : la publication de l'écran Annonces (src/republierPriorite.js),
              seulement quand elle propose au moins une paire ; le toucher ouvre Annonces sur « À republier ». Rien ne part d'ici. */}
          {!lecture && aRepublier && aRepublier.n > 0 ? <Rangee icone={<Icon name="sync" size={22}/>} titre={tr('prio.journee', { n: aRepublier.n })} lignes={2} sousTitre={tr('prio.journeeSous', { jours: aRepublier.jours })}
            fin="chevron" onClick={aRepublier.ouvrir} attrs={{ 'data-prio-journee': String(aRepublier.n) }}/> : null}
        </Carte>
      );
    },
    // Rien à envoyer ni à retirer : à la place d'« À envoyer », UNE carte qui le dit (jamais deux cartes vides).
    envoyer: () => (rien && !(n > 0) ? <Carte attrs={{ 'data-v2-bloc': 'rien', 'data-v2-rien': '' }}><Vide icone={<Icon name="check" size={40}/>} phrase={tr('v2.rien.titre')} detail={tr('v2.rien.sous')}/></Carte> : (
      <Carte titre={tr('v2.envoyer.titre')} n={nombre(n)} sousTitre={alerteEnv ? alerte.txt : (affiche.sous || '')} tonSous={alerteEnv ? 'ambre' : 'neutre'}
        action={plein ? <Bouton variante="plein" onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n) }}>{tr('v2.imprimer', { n: plein.n })}</Bouton> : null}
        attrs={{ 'data-v2-bloc': 'envoyer', 'data-v2-groupe': 'envoyer', 'data-v2-envoyer': String(n), 'data-v2-ecart': affiche.sous || '', 'data-v2-alerte': alerteEnv ? 'poster' : undefined, 'data-v2-bande': String(montres.length) }}>
        {montres.map((c) => (
          // (19 nov.) Le titre a SA ligne (2 au plus) et le prix à droite ; dessous « N° · échéance · transporteur ».
          <Rangee key={c.cle} vignette={image(c.photo, 44)} titre={c.titre || (c.num ? 'N° ' + c.num : tr('v2.dv.vente', { site: c.site || '' }))} lignes={2} plaque={<>{c.site ? <LogoSite site={c.site} taille={16}/> : null}{c.num ? <Plaque numero={c.num}/> : null}</>}
            sousTitre={[c.tr, c.compte].filter(Boolean).join(' · ')} pastilleSous={c.e && c.e.txt ? <Pastille ton={c.e.ambre ? 'ambre' : 'neutre'}>{c.e.txt}</Pastille> : null}
            valeur={c.prix || ''} valeurForte onClick={() => onColis && onColis(c)} attrs={{ 'data-v2-colis': c.cle, 'data-v2-colis-presse': c.e && c.e.ambre ? '1' : undefined }}/>
        ))}
        {resteEnv > 0 ? <Rangee titre={tr('v2.bande.plus', { n: resteEnv })} fin="chevron" onClick={() => onColis && onColis(null)} attrs={{ 'data-n-plus': String(resteEnv) }}/> : null}
      </Carte>
    )),
    retirer: () => (
      <Carte titre={tr('v2.retirer.titre')} n={nombre(nRet)} tonSous={retraits.premier && retraits.premier.ambre ? 'ambre' : 'neutre'}
        // (20 nov., chasse-bugs-2) Chaque nombre a SON pluriel : « 2 colis · 1 points » (l'ancienne clé accordait les points au nombre de colis).
        sousTitre={[pts.length ? tr('v2.retirer.resumeN', { n: nRet }) + ' · ' + tr('v2.retirer.points', { n: retraits.nPoints || 1 }) : tr('v2.retirer.resumeN', { n: nRet }), retraits.premier ? retraits.premier.txt : ''].filter(Boolean).join(' · ')}
        attrs={{ 'data-v2-bloc': 'retirer', 'data-v2-groupe': 'retirer', 'data-v2-alerte': alerte && alerte.id === 'retirer' ? 'retirer' : undefined }}>
        {ptsMontres.length ? ptsMontres.map((pt, k) => (
          <Rangee key={(pt.lieu || '?') + k} icone={<Icon name="pin" size={22}/>} titre={pt.lieu || tr('v2.retirer.pointInconnu')}
            valeur={pt.code ? <span data-v2-passe-code={pt.code}>{pt.code}</span> : ''} valeurForte fin="chevron" onClick={onRetraits}
            attrs={k === 0 ? { 'data-v2-passe-mini': '', 'data-v2-n': String(nRet), 'data-v2-passe-lieu': pt.lieu || '' } : null}/>
        )) : nRet ? <Rangee icone={<Icon name="pin" size={22}/>} titre={tr('v2.retirer.codesAVenir')} fin="chevron" onClick={onRetraits} attrs={{ 'data-v2-passe-mini': '', 'data-v2-n': String(nRet), 'data-v2-passe-lieu': '' }}/> : null}
        {restePts > 0 ? <Rangee titre={tr('v2.retirer.autresPoints', { n: restePts })} fin="chevron" onClick={onRetraits}/> : null}
        {/* (21 nov., ext. 5.411) LA PRÉVISION : les achats en route sous LEUR point (« Demain : 1 colis chez Relais X »), une date LUE
            seulement ; sans date lue, « En route : … » (src/relaisPrevision.js, la phrase publiée par l'écran des colis). */}
        {retraits && retraits.prevision ? <Rangee icone={<Icon name="truck" size={22}/>} titre={retraits.prevision.phrase} lignes={2} fin="chevron" onClick={onRetraits}
          attrs={{ 'data-journee-prevision': retraits.prevision.quand }}/> : null}
      </Carte>
    ),
    ventes: () => (
      <Carte titre={tr('v2.dv.titre')} attrs={{ 'data-v2-bloc': 'ventes', 'data-v2-dernieres': String(lignesV.length) }}>
        {lignesV.map((l) => (
          <Rangee key={l.cle} vignette={image(l.photo, 44)} titre={l.titre || tr('v2.dv.vente', { site: l.site })} lignes={2} plaque={l.num ? <Plaque numero={l.num}/> : null}
            sousTitre={[l.site, ilYaCourt(l.ts)].filter(Boolean).join(' · ')} valeur={l.prix} valeurForte onClick={l.ouvrir || onVentes} attrs={{ 'data-v2-vente': l.cle }}/>
        ))}
        {aVenirLu ? <Rangee titre={tr('v2.dv.aVenir')} valeur={(aVenir.partiel ? tr('journee.moins') + ' ' : '') + aVenir.texte} fin="chevron" onClick={aVenir.ouvrir} attrs={{ 'data-v2-avenir': cents(aVenir.valeur) }}/> : null}
      </Carte>
    ),
    // LA COURBE DES 30 JOURS (vendu par jour) : toucher ou glisser choisit un jour ; ses chiffres dans l'en-tête.
    courbe: () => {
      const L = courbe && Array.isArray(courbe.jours) ? courbe.jours : [];
      const k = jour == null || jour >= L.length ? L.length - 1 : jour, j = L[k] || null;
      const quand = j ? new Date(j.de).toLocaleDateString(localeCourante(), { weekday: 'long', day: 'numeric', month: 'short' }) : '';
      const sous = !j ? '' : j.v == null ? quand + ' · —' : [quand, (j.partiel ? tr('journee.moins') + ' ' : '') + montant(j.v), j.n != null ? tr('v2.comptes.ventes', { n: j.n }) : ''].filter(Boolean).join(' · ');
      return (
        <Carte titre={tr('v2.courbe.titre')} sousTitre={sous} attrs={{ 'data-v2-bloc': 'courbe', 'data-v2-courbe': L.map((x) => cents(x.v)).join(','), 'data-v2-courbe-jour': j ? j.cle : '' }}>
          <Courbe libelle={tr('v2.courbe.titre')} choisie={k} onChoisir={setJour} barres={L.map((x) => ({ cle: x.cle, valeur: x.v, libelle: new Date(x.de).toLocaleDateString(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + (x.v == null ? '—' : montant(x.v)) }))}/>
          <Rangee titre={tr('v2.courbe.voir')} fin="chevron" onClick={onVentes}/>
        </Carte>
      );
    },
    // PAR COMPTE ET PAR SITE, sur la période choisie (la règle de « Quel compte vend le mieux »).
    comptes: () => {
      const L = comptes && comptes[p] ? comptes[p].slice(0, 6) : [];
      return (
        <Carte titre={tr('v2.comptes.titre')} sousTitre={tr('v2.stats.' + p)} attrs={{ 'data-v2-bloc': 'comptes', 'data-v2-comptes': L.map((x) => x.cle + ':' + cents(x.v) + ':' + (x.n == null ? '' : x.n)).join(',') }}>
          {L.length ? L.map((x) => (
            <Rangee key={x.cle} titre={x.nom} sousTitre={[x.site !== x.nom ? x.site : '', x.n != null ? tr('v2.comptes.ventes', { n: x.n }) : ''].filter(Boolean).join(' · ')}
              valeur={x.v == null ? '—' : (x.vp ? tr('journee.moins') + ' ' : '') + montant(x.v)} valeurForte onClick={onVentes}/>
          )) : <Rangee titre={comptes ? tr('v2.comptes.vide') : tr('v2.jour.pasSu')}/>}
        </Carte>
      );
    },
    // SUR TES ANNONCES AUJOURD'HUI : ce que l'extension a capté depuis minuit (offres, messages) ; les favoris : pas captés.
    annonces: () => {
      const C = capte || null;
      const v = (x) => (C && x != null ? nombre(x) : null);
      const raison = C ? tr('v2.capte.pasCapte') : tr('v2.capte.pasLu');
      return (
        <Carte titre={tr('v2.capte.titre')} attrs={{ 'data-v2-bloc': 'annonces', 'data-v2-capte': C ? [C.offres, C.messages].join(',') : '' }}>
          <Faits colonnes={3}>
            <Fait libelle={tr('v2.capte.favoris')} valeur={v(C && C.favoris)} detail={C && C.favoris != null ? '' : raison}/>
            <Fait libelle={tr('v2.capte.offres')} valeur={v(C && C.offres)} detail={C ? '' : raison} onModifier={onMessages}/>
            <Fait libelle={tr('v2.capte.messages')} valeur={v(C && C.messages)} detail={C ? '' : raison} onModifier={onMessages}/>
          </Faits>
        </Carte>
      );
    },
    // CE QUE VRM A FAIT AUJOURD'HUI, en une ligne (les gestes acceptés du journal) ; « — » si rien.
    vrm: () => {
      const L = Array.isArray(vrm) ? vrm : null;
      const texte = !L ? '—' : L.length ? L.map((x) => tr('v2.vrm.' + x.cle, { n: x.n })).join(' · ') : '—';
      return (
        <Carte titre={tr('v2.vrm.titre')} attrs={{ 'data-v2-bloc': 'vrm', 'data-v2-vrm': L ? L.map((x) => x.cle + ':' + x.n).join(',') : '' }}>
          <Rangee titre={texte} lignes={2} sousTitre={!L ? tr('v2.vrm.pasLu') : L.length ? '' : tr('v2.vrm.rien')} fin="chevron" onClick={onJournal}/>
        </Carte>
      );
    },
    // (19 nov., « tu peux trouver mieux, peut-être d'autres stats ») — chaque carte dit pourquoi quand elle n'a rien.
    // STOCK EN LIGNE : en ligne · au prix d'achat (« au moins … · sur N » quand des prix manquent).
    stock: () => {
      const S2 = stats2 && stats2.stock;
      const detailA = !S2 ? '' : S2.achat == null ? tr('v2.st.raison.' + (S2.raisonAchat || 'achats')) : S2.achatPartiel ? tr('v2.st.auMoinsSur', { k: nombre(S2.achatNPrix || 0), n: nombre(S2.achatN || 0) }) : tr('v2.st.surN', { n: nombre(S2.achatN || 0) });
      const ouvrir = onNav ? () => onNav('cat_annonces') : null;
      // (20 nov., « ce qui manque ») AU PRIX AFFICHÉ : la publication d'Annonces (src/stockValeurAffiche.js) — une paire comptée
      // une fois même sur plusieurs sites, prix Vinted sinon le plus bas (dit), « au moins … sur N » quand un prix manque.
      const VA = S2 && S2.affiche;
      const detailP = !VA ? tr('v2.st.raison.annonces') : [VA.auMoins ? tr('v2.st.auMoinsSur', { k: nombre(VA.nPrix || 0), n: nombre(VA.n || 0) }) : tr('v2.st.surN', { n: nombre(VA.n || 0) }), tr('cqm.stock.source')].join(' · ');
      return (
        <Carte titre={tr('v2.st.stock.titre')} attrs={{ 'data-v2-bloc': 'stock', 'data-v2-stock': S2 ? [S2.enLigne == null ? '' : S2.enLigne, cents(S2.achat)].join(',') : '',
          'data-v2-stock-affiche': VA && VA.centimes != null ? [VA.centimes, VA.n, VA.nPrix].join(',') : '' }}>
          <Faits colonnes={3}>
            <Fait libelle={tr('v2.st.stock.enLigne')} valeur={S2 && S2.enLigne != null ? nombre(S2.enLigne) : null} detail={S2 && S2.enLigne == null ? (S2.raisonEnLigne || tr('v2.jour.pasSu')) : ''} onModifier={ouvrir}/>
            <Fait libelle={tr('cqm.stock.affiche')} valeur={VA && VA.centimes != null ? (VA.auMoins ? tr('journee.moins') + ' ' : '') + montant(VA.centimes / 100) : null} detail={detailP} onModifier={ouvrir} attrs={{ 'data-v2-stock-prix': VA && VA.centimes != null ? String(VA.centimes) : '' }}/>
            <Fait libelle={tr('v2.st.stock.achat')} valeur={S2 && S2.achat != null ? montant(S2.achat) : null} detail={detailA} onModifier={ouvrir}/>
          </Faits>
        </Carte>
      );
    },
    // VITESSE DE VENTE : le délai médian mise en ligne → vente (période choisie, « sur N »), l'écoulement sur 30 jours.
    vitesse: () => {
      const P = stats2 && stats2.parPeriode ? stats2.parPeriode[p] : null, Vt = P && P.vitesse, E = stats2 && stats2.ecoulement;
      const ouvrir = onNav ? () => onNav('stats') : null;
      return (
        <Carte titre={tr('v2.st.vitesse.titre')} sousTitre={tr('v2.stats.' + p)} attrs={{ 'data-v2-bloc': 'vitesse', 'data-v2-vitesse': [Vt && Vt.mediane != null ? Vt.mediane : '', E ? E.pct : ''].join(',') }}>
          <Faits colonnes={2}>
            <Fait libelle={tr('v2.st.vitesse.delai')} valeur={Vt && Vt.mediane != null ? tr('v2.st.jours', { n: Math.round(Vt.mediane), j: nombre(Math.round(Vt.mediane)) }) : null}
              detail={!stats2 || stats2.parPeriode === undefined ? tr('v2.jour.lecture') : !P ? tr('v2.st.raison.releve') : Vt && Vt.mediane != null ? tr('v2.st.mediane', { k: nombre(Vt.nDelai), n: nombre(Vt.n) }) : tr('v2.st.raison.dates')} onModifier={ouvrir}/>
            <Fait libelle={tr('v2.st.vitesse.ecoulement')} valeur={E ? E.pct + ' %' : null} detail={E ? tr('v2.st.ecoulementSur', { v: nombre(E.ventes), n: nombre(E.enLigne) }) : tr('v2.st.raison.ecoulement')} onModifier={ouvrir}/>
          </Faits>
        </Carte>
      );
    },
    // PRÉVISION DU MOIS : la règle d'Argent, avec sa fourchette (« entre … et … »).
    prevision: () => {
      const Pv = stats2 && stats2.prevision;
      const e = (c) => montant(Math.round(c / 100));
      const ok = !!Pv && Pv.etat === 'ok' && Pv.centre != null;
      const raison = !Pv || Pv.etat === 'encours' ? tr('v2.jour.lecture') : Pv.etat === 'tot' ? tr('v2.st.prev.tot', { n: Pv.joursManquants || 0 }) : Pv.etat === 'rien' ? tr('v2.st.prev.rien') : tr('v2.jour.pasSu');
      return (
        <Carte titre={tr('v2.st.prev.titre')} attrs={{ 'data-v2-bloc': 'prevision', 'data-v2-prevision': ok ? [Pv.centre, Pv.bas, Pv.haut].join(',') : '' }}>
          <Faits colonnes={2}>
            <Fait libelle={tr('v2.st.prev.vers')} valeur={ok ? (Pv.partiel ? tr('journee.moins') + ' ' : '') + e(Pv.centre) : null} detail={ok ? tr('v2.st.prev.entre', { bas: e(Pv.bas), haut: e(Pv.haut) }) : raison} onModifier={onNav ? () => onNav('compta') : null}/>
            <Fait libelle={tr('v2.st.prev.deja')} valeur={Pv && Pv.cumul != null ? e(Pv.cumul) : null} detail={Pv && Pv.cumul != null ? tr('v2.st.prev.jours', { n: Pv.jours, m: Pv.joursMois }) : raison} onModifier={onNav ? () => onNav('compta') : null}/>
          </Faits>
        </Carte>
      );
    },
    // MARGE : bénéfice brut ÷ CA des ventes au prix d'achat connu (période choisie), « sur N ventes au prix connu ».
    marge: () => {
      const P = stats2 && stats2.parPeriode ? stats2.parPeriode[p] : null, M = P && P.marge;
      const ouvrir = onNav ? () => onNav('stats') : null;
      return (
        <Carte titre={tr('v2.st.marge.titre')} sousTitre={tr('v2.stats.' + p)} attrs={{ 'data-v2-bloc': 'marge', 'data-v2-marge': M && M.pct != null ? String(M.pct) : '' }}>
          <Faits colonnes={2}>
            <Fait libelle={tr('v2.st.marge.pct')} valeur={M && M.pct != null ? nombre(M.pct) + ' %' : null} detail={!P ? tr('v2.st.raison.releve') : M && M.pct != null ? tr('v2.st.marge.sur', { k: nombre(M.nCout), n: nombre(M.n) }) : (M && M.n ? tr('v2.st.raison.achats') : tr('v2.comptes.vide'))} onModifier={ouvrir}/>
            <Fait libelle={tr('v2.stats.beneficeBrut')} valeur={M && M.brut != null ? montant(M.brut) : null} detail={M && M.brut != null ? '' : ' '} onModifier={ouvrir}/>
          </Faits>
        </Carte>
      );
    },
    // MARQUES : les ventes de la période par la marque LUE de l'annonce (jamais devinée) ; le reste « sans marque lue ».
    marques: () => {
      const P = stats2 && stats2.parPeriode ? stats2.parPeriode[p] : null, Q = P && P.marques;
      const L = Q ? Q.top : [];
      return (
        <Carte titre={tr('v2.st.marques.titre')} sousTitre={tr('v2.stats.' + p)} attrs={{ 'data-v2-bloc': 'marques', 'data-v2-marques': L.map((x) => x.k + ':' + cents(x.ca) + ':' + x.n).join(',') }}>
          {L.length ? L.map((x) => <Rangee key={x.k} titre={x.k} sousTitre={tr('v2.comptes.ventes', { n: x.n })} valeur={montant(x.ca)} valeurForte onClick={onNav ? () => onNav('stats') : null}/>)
            : <Rangee titre={!P ? tr('v2.st.raison.releve') : tr('v2.st.marques.aucune')}/>}
          {Q && Q.sansMarque ? <Rangee titre={tr('v2.st.marques.sans', { n: Q.sansMarque })}/> : null}
        </Carte>
      );
    },
    // PAIRES QUI DORMENT : en ligne depuis plus de 30 jours sans vente (la publication d'Annonces) ; toucher ⇒ la liste.
    dorment: () => {
      const D = stats2 && stats2.dorment;
      return (
        <Carte titre={tr('v2.st.dorment.titre')} attrs={{ 'data-v2-bloc': 'dorment', 'data-v2-dorment': D && D.valeur != null ? String(D.valeur) : '' }}>
          <Rangee icone={<Icon name="sleep" size={22}/>} titre={D && D.valeur != null ? (D.partiel ? tr('journee.moins') + ' ' : '') + tr('v2.st.dorment.n', { n: D.valeur }) : '—'}
            sousTitre={D && D.valeur != null ? tr('v2.st.dorment.sous') : (D && D.raison) || tr('v2.jour.pasSu')} fin="chevron" onClick={onDorment}/>
        </Carte>
      );
    },
    // ARGENT À VENIR : la règle d'Argent (`attente`).
    avenir: () => {
      const A = stats2 && stats2.avenir;
      return (
        <Carte titre={tr('v2.dv.aVenir')} attrs={{ 'data-v2-bloc': 'avenir', 'data-v2-avenir2': A && A.valeur != null ? cents(A.valeur) : '' }}>
          <Rangee icone={<Icon name="euro" size={22}/>} titre={A && A.valeur != null ? (A.partiel ? tr('journee.moins') + ' ' : '') + montant(A.valeur) : '—'}
            sousTitre={A && A.valeur != null ? tr('v2.st.avenir.sous') : (A && A.raison) || tr('v2.jour.pasSu')} fin="chevron" onClick={onAVenir}/>
        </Carte>
      );
    },
    // VUES ET FAVORIS (20 nov., « ce qui manque ») : la publication d'Annonces (src/vuesFavoris.js) — les totaux des annonces
    // EN LIGNE lus dans le dressing (aucune requête de plus), « + N aujourd'hui » (le dernier point d'avant aujourd'hui), « sur N
    // annonces » ; jamais publiée ⇒ « — · ouvre Annonces » ; aucun chiffre lu ⇒ « — · pas fourni par le site ». Jamais un 0 inventé.
    vues: () => {
      const W = stats2 && stats2.vues;
      const ouvrir = onNav ? () => onNav('cat_annonces') : null;
      const signe = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + nombre(Math.abs(x));
      const fait = (cle, X) => {
        const val = X && X.total != null ? (W.manque ? tr('journee.moins') + ' ' : '') + nombre(X.total) : null;
        const detail = !W ? tr('v2.st.raison.annonces') : !X || X.total == null ? tr('cqm.pasFourni')
          : [X.gagnes != null ? tr('cqm.vues.aujourdhui', { s: signe(X.gagnes) }) : '', tr('cqm.vues.sur', { n: X.n })].filter(Boolean).join(' · ');
        return <Fait libelle={tr('v2.st.vues.' + cle)} valeur={val} detail={detail} onModifier={ouvrir} attrs={{ 'data-v2-vues-fait': cle, 'data-v2-vues-total': X && X.total != null ? String(X.total) : '', 'data-v2-vues-gagnes': X && X.gagnes != null ? String(X.gagnes) : '' }}/>;
      };
      return (
        <Carte titre={tr('v2.st.vues.titre')} attrs={{ 'data-v2-bloc': 'vues', 'data-v2-vues': W ? 'lu' : 'passu' }}>
          <Faits colonnes={2}>
            {fait('vues', W && W.vues)}
            {fait('favoris', W && W.favoris)}
          </Faits>
        </Carte>
      );
    },
    // Un retour à déposer aujourd'hui ou demain n'a pas de carte à lui : UNE rangée, en fin de page.
    retour: () => (
      <Carte attrs={{ 'data-v2-bloc': 'retour' }}>
        <Rangee icone={<Icon name="restore" size={22}/>} titre={tr('v2.alerte.retourTitre')} sousTitre={alerte.txt} ton="ambre" fin="chevron" onClick={alerte.faire} attrs={{ 'data-v2-alerte': 'retour' }}/>
      </Carte>
    ),
  };
  const presents = { colis: true, chiffres: !!chiffres, envoyer: n > 0 || rien, retirer: !!nRet || !!(retraits && retraits.prevision), ventes: lignesV.length > 0 || aVenirLu, courbe: !!courbe, comptes: true, annonces: true, vrm: true, stock: true, vitesse: true, prevision: true, marge: true, marques: true, dorment: true, avenir: true, vues: true, retour: !!alerte && alerte.id === 'retour' };
  // L'ordre et les cartes montrées sont LES SIENS (« Personnaliser », `vrm_aujourdhui_cartes`, synchronisé) ; avant que
  // les lectures soient là, seules les chiffres sont montrés à leur taille (rien qui saute ensuite).
  const montrees = choix.ordre.filter((k) => choix.montrees.has(k) && presents[k] && (k === 'chiffres' || k === 'colis' || pret));
  // « PERSONNALISER » (19 nov., « ça doit être bien fait ») : retirer / ajouter / déplacer ; l'écran derrière suit en direct.
  const poser = (ordre, m) => { if (cartes && cartes.poser) cartes.poser({ ordre, montrees: CARTES_AUJOURDHUI.filter((x) => m.has(x)) }); };
  const basculer = (k) => { const m = new Set(choix.montrees); if (m.has(k)) m.delete(k); else m.add(k); poser(choix.ordre, m); };
  // Déplacer parmi les cartes MONTRÉES : l'ordre complet garde les autres à leur place relative.
  const deplacerMontree = (de, vers) => {
    const vis = choix.ordre.filter((k) => choix.montrees.has(k));
    const a = vis[de], b = vis[vers]; if (!a || !b || a === b) return;
    const o = choix.ordre.filter((k) => k !== a); const ib = o.indexOf(b);
    o.splice(vers > de ? ib + 1 : ib, 0, a);
    poser(o, choix.montrees);
  };
  const deposer = (a, b) => { const vis = choix.ordre.filter((k) => choix.montrees.has(k)); deplacerMontree(vis.indexOf(a), vis.indexOf(b)); };
  const parDefaut = () => { setDefait({ ordre: [...choix.ordre], montrees: [...choix.montrees], id: Date.now() }); poser([...CARTES_AUJOURDHUI], new Set(CARTES_DEFAUT)); };
  // Ce que montre chaque carte, en une phrase, et l'aperçu de sa valeur actuelle.
  const ICONES = { colis: 'truck', chiffres: 'chart', envoyer: 'truck', retirer: 'pin', stock: 'box', vitesse: 'clock', prevision: 'target', courbe: 'chart', ventes: 'bag', comptes: 'users',
    marge: 'balance', marques: 'tag', dorment: 'sleep', avenir: 'euro', annonces: 'heart', vues: 'eye', vrm: 'check' };
  const S2 = stats2 || {};
  const apercu = (k) => {
    try {
      const st = chiffres && chiffres.stats ? chiffres.stats[p] : null;
      if (k === 'chiffres') return st && st.vendu.valeur != null ? montant(st.vendu.valeur) : '—';
      if (k === 'colis') return n == null && nRet == null ? '—' : [n == null ? '—' : nombre(n), nRet == null ? '—' : nombre(nRet)].join(' · ');
      if (k === 'envoyer') return n == null ? '—' : nombre(n);
      if (k === 'retirer') return nRet == null ? '—' : nombre(nRet);
      if (k === 'stock') return S2.stock && S2.stock.enLigne != null ? nombre(S2.stock.enLigne) : '—';
      if (k === 'vitesse') { const V = S2.parPeriode && S2.parPeriode[p] && S2.parPeriode[p].vitesse; return V && V.mediane != null ? tr('v2.st.jours', { n: Math.round(V.mediane), j: nombre(Math.round(V.mediane)) }) : '—'; }
      if (k === 'prevision') return S2.prevision && S2.prevision.etat === 'ok' ? montant(Math.round(S2.prevision.centre / 100)) : '—';
      if (k === 'courbe') return courbe && courbe.jours ? String(courbe.jours.length) + ' j' : '—';
      if (k === 'ventes') return nombre(lignesV.length);
      if (k === 'marge') { const M = S2.parPeriode && S2.parPeriode[p] && S2.parPeriode[p].marge; return M && M.pct != null ? nombre(M.pct) + ' %' : '—'; }
      if (k === 'dorment') return S2.dorment && S2.dorment.valeur != null ? nombre(S2.dorment.valeur) : '—';
      if (k === 'avenir') return S2.avenir && S2.avenir.valeur != null ? montant(S2.avenir.valeur) : '—';
      if (k === 'annonces') return capte ? nombre((capte.offres || 0) + (capte.messages || 0)) : '—';
      if (k === 'vrm') return Array.isArray(vrm) ? nombre(vrm.reduce((t, x) => t + x.n, 0)) : '—';
      return '—';
    } catch (_) { return '—'; }
  };
  const element = (k) => ({ cle: k, nom: tr('v2.perso.carte.' + k), phrase: tr('v2.perso.phrase.' + k), apercu: apercu(k), icone: <Icon name={ICONES[k] || 'check'} size={18}/> });
  const visibles = choix.ordre.filter((k) => choix.montrees.has(k));
  const aAjouter = choix.ordre.filter((k) => !choix.montrees.has(k));
  const libellesListe = { retirer: (x) => tr('v2.perso.retirerX', { x }), ajouter: (x) => tr('v2.perso.ajouterX', { x }), deplacer: (x) => tr('v2.perso.deplacerX', { x }), monter: tr('v2.perso.monter'), descendre: tr('v2.perso.descendre') };
  const seules = new Set();
  { let col = 0; montrees.forEach((k, i) => { if (k === 'chiffres') { col = 0; return; } const suiv = montrees[i + 1]; if (col === 0 && (suiv == null || suiv === 'chiffres')) { seules.add(k); return; } col = 1 - col; }); }
  const enregistrerObjectif = () => { if (!objectif || !objectif.enregistrer) return; if (objectif.enregistrer(saisie)) setObjOuvert(false); else setSaisieKo(true); };
  return (
    <Page titre={titre}
      actions={onScanner ? <BoutonIcone libelle={tr('v2.scanner')} icone={<Icon name="scan" size={22}/>} onClick={onScanner} attrs={{ 'data-v2-scanner': '' }}/> : null}
      attrs={{ 'data-v2-ecran': 'aujourdhui', 'data-espace': 'journee', 'data-v2-affiche': !pret || n == null ? '' : String(n), 'data-v2-attente': pret ? undefined : '1', 'data-v2-cartes': montrees.join(',') }}>
      {/* Une grille de cartes à l'ordinateur (les chiffres en pleine largeur), la même suite au téléphone. */}
      <Colonnes>
        {haut ? <Colonne pleine>{haut}</Colonne> : null}
        {/* (21 nov., ext. 5.428 `endirect`) Ce que fait l'extension EN CE MOMENT, en tête (src/extension/EnDirect.jsx). */}
        {enDirect ? <Colonne pleine>{enDirect}</Colonne> : null}
        {/* (22 nov., bugs-totale) Une carte SEULE sur sa rangée (sa voisine est une carte pleine, ou il n'y en a pas) prend toute la
            largeur : à l'ordinateur, « Colis » et « Dernières ventes » tenaient une demi-colonne, la moitié droite vide. */}
        {montrees.map((k) => (
          <Colonne key={k} pleine={k === 'chiffres' || seules.has(k)}>
            <Editable cle={k} actif={modifier && ordinateur} libelleRetirer={tr('v2.perso.retirerX', { x: tr('v2.perso.carte.' + k) })} onRetirer={() => basculer(k)} onDeposer={deposer}>
              {k === 'chiffres' ? <Chiffres chiffres={chiffres} p={p} setP={setP} objectif={obj} onSaisirPrix={onSaisirPrix} onVentes={onVentes}/> : BLOCS[k]()}
            </Editable>
          </Colonne>))}
        {modifier && ordinateur ? <Colonne><button type="button" className="n-ajout-carte" onClick={() => setPerso(true)} data-v2-ajout-carte="">{'+ ' + tr('v2.perso.ajouter')}</button></Colonne> : null}
        {pret && rien && !montrees.includes('envoyer') && !montrees.some((k) => k !== 'chiffres') ? <Colonne><Carte attrs={{ 'data-v2-bloc': 'rien', 'data-v2-rien': '' }}><Vide icone={<Icon name="check" size={40}/>} phrase={tr('v2.rien.titre')} detail={tr('v2.rien.sous')}/></Carte></Colonne> : null}
        {pret && presents.retour ? <Colonne>{BLOCS.retour()}</Colonne> : null}
        {/* (22 nov., « zéro saut ») « Toutes les statistiques » et « Personnaliser » closent l'écran : posés AVEC les cartes (`pret`),
            jamais avant — sinon les cartes arrivées ensuite les poussaient hors de la fenêtre (banc couches-chargement : CLS 0,05). */}
        {onNav && pret ? <Colonne pleine><Groupe><Rangee icone={<Icon name="chart" size={22}/>} titre={tr('v2.af.toutesStats')} sousTitre={tr('v2.af.toutesStatsSous')} fin="chevron" onClick={() => onNav('dashboard')} attrs={{ 'data-v2-vers-stats': '' }}/></Groupe></Colonne> : null}
        {cartes && cartes.poser && pret ? <Colonne pleine><div className="n-ecran-outils">
          {ordinateur ? <Bouton variante="texte" onClick={() => setModifier(!modifier)} attrs={{ 'data-v2-modifier': modifier ? '1' : '0' }}>{modifier ? tr('v2.perso.fini') : tr('v2.perso.modifier')}</Bouton> : null}
          <Bouton variante="texte" onClick={() => setPerso(true)} attrs={{ 'data-v2-perso': '' }}>{tr('v2.perso.ouvrir')}</Bouton>
        </div></Colonne> : null}
      </Colonnes>
      <Feuille ouverte={perso} onFermer={() => setPerso(false)} titre={tr('v2.perso.titre')} terminer={tr('v2.perso.termine')} detente="pleine" attrs={{ 'data-v2-feuille-perso': '' }}>
        <Groupe titre={tr('v2.perso.affichees')} pied={tr('v2.perso.pied')}/>
        <ListeOrdonnee mode="montrees" elements={visibles.map(element)} onBasculer={basculer} onDeplacer={deplacerMontree} libelles={libellesListe}
          attrs={{ 'data-v2-perso-montrees': visibles.join(',') }} attrsElement={(x) => ({ 'data-v2-perso-carte': x.cle })}/>
        {aAjouter.length ? <Groupe titre={tr('v2.perso.aAjouter')}/> : null}
        {aAjouter.length ? <ListeOrdonnee mode="ajout" elements={aAjouter.map(element)} onBasculer={basculer} libelles={libellesListe}
          attrs={{ 'data-v2-perso-ajout': aAjouter.join(',') }} attrsElement={(x) => ({ 'data-v2-perso-carte': x.cle })}/> : null}
        <Groupe><Rangee titre={tr('v2.perso.defaut')} onClick={parDefaut} attrs={{ 'data-v2-perso-defaut': '' }}/></Groupe>
      </Feuille>
      {defait ? <Toast key={defait.id} message={tr('v2.perso.remis')} onAnnuler={() => { poser(defait.ordre, new Set(defait.montrees)); setDefait(null); }} onFin={() => setDefait(null)}/> : null}
      <Feuille ouverte={objOuvert} onFermer={() => setObjOuvert(false)} titre={tr('v2.obj.titre')} detente="moitie"
        pied={<Bouton variante="plein" onClick={enregistrerObjectif}>{tr('v2.obj.enregistrer')}</Bouton>}>
        <Champ libelle={tr('v2.obj.libelle')} valeur={saisie} onChange={(v) => { setSaisie(v); setSaisieKo(false); }} inputMode="decimal" suffixe="€" attrs={{ 'data-v2-objectif-saisie': '' }}/>
        {saisieKo ? <Groupe pied={tr('v2.obj.invalide')}/> : null}
        {objectif && objectif.cible && objectif.retirer ? <Groupe><Rangee titre={tr('v2.obj.retirer')} onClick={() => { objectif.retirer(); setObjOuvert(false); }}/></Groupe> : null}
      </Feuille>
    </Page>
  );
}
