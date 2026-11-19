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
import { tr, nombre, localeCourante } from '../../i18n/index.js';
import { Page, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Vide, Segmente, Colonnes, Colonne, Carte, Tuiles, Tuile, Pastille, Faits, Fait, Feuille, Courbe, Progression, Champ } from '../index.js';
import { CARTES_AUJOURDHUI, CARTES_DEFAUT, cartesChoisies } from '../../aujourdhui/modele.js';
import { publierARegler } from '../../designV2/aRegler.js';

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
    if (min < 48 * 60) return f.format(-Math.round(min / 60), 'hour');
    return f.format(-Math.round(min / 1440), 'day');
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
const NOTE = { aucune: 'v2.stats.aucune', partiel: 'v2.stats.pasTout' };
function Chiffres({ chiffres, p, setP, objectif = null }) {
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
  const B = S ? S.benefice : null;
  const detailB = !B ? '' : B.valeur == null ? note(B) : B.couverture ? tr('v2.stats.auMoinsSur', { c: B.couverture }) : '';
  // Ce que le banc lit (les nombres, jamais un libellé) : chaque période, chaque chiffre, en centimes ; « » = pas su.
  const resume = !stats || etat !== 'lu' ? '' : JSON.stringify(Object.fromEntries(PERIODES.map((k) => { const x = stats[k]; return [k, {
    vendu: cents(x.vendu.valeur), vp: x.vendu.partiel ? 1 : 0, ventes: x.ventes.valeur == null ? '' : String(x.ventes.valeur), np: x.ventes.partiel ? 1 : 0, benefice: cents(x.benefice.valeur),
    bp: x.benefice.partiel ? 1 : 0, couverture: x.benefice.couverture || '', panier: cents(x.panier.valeur), ecart: x.ecart == null ? '' : String(x.ecart) }]; })));
  const nul = (x) => (x == null ? null : x);
  // La MÊME hauteur en lecture, lu, pas su, et d'une période à l'autre : la ligne de l'écart et le détail de chaque fait
  // sont toujours là (une espace insécable quand il n'y a rien à dire) — rien ne saute quand le chiffre arrive.
  const detailV = !V ? '' : V.valeur == null ? (raison || V.note || '') : [V.partiel ? tr('journee.moins') : '', ecart].filter(Boolean).join(' · ');
  // (19 nov., « entre Vintex et celui-là ») QUATRE TUILES à filet : CA vendu · Bénéfice · Ventes · Panier moyen, l'écart en
  // petit sous le CA ; le segmenté Jour · Semaine · Mois au-dessus (à droite à l'ordinateur). Même hauteur dans tous les états.
  return (
    <Tuiles titre={tr('v2.stats.titre')} pied={objectif ? <ObjectifLigne objectif={objectif} montant={montant}/> : null} action={<Segmente libelle={tr('v2.stats.periode')} valeur={p} onChange={setP} options={PERIODES.map((k) => ({ cle: k, libelle: tr('v2.stats.' + k) }))}/>}
      attrs={{ 'data-v2-bloc': 'chiffres', 'data-v2-chiffres': etat, 'data-v2-periode': p, 'data-v2-stats': resume, 'aria-busy': etat === 'encours' ? 'true' : undefined, 'aria-label': libelle,
        'data-v2-jour-vendu': etat === 'lu' && stats ? cents(stats.jour.vendu.valeur) : '', 'data-v2-jour-ventes': etat === 'lu' && stats && stats.jour.ventes.valeur != null ? String(stats.jour.ventes.valeur) : '' }}>
      <Tuile libelle={tr('v2.stats.ca')} valeur={n} unite={u} detail={etat === 'encours' ? tr('v2.jour.lecture') : detailV} onClick={ouvrir} attrs={{ 'data-v2-stat': 'vendu' }}/>
      <Tuile libelle={B && B.brut ? tr('v2.stats.beneficeBrut') : tr('v2.stats.benefice')} valeur={B && B.valeur != null ? coupe(montant(B.valeur))[0] : null} unite={B && B.valeur != null ? coupe(montant(B.valeur))[1] : ''}
        detail={detailB} onClick={ouvrir} attrs={{ 'data-v2-stat': 'benefice' }}/>
      <Tuile libelle={tr('v2.stats.ventes')} valeur={S && S.ventes.valeur != null ? nombre(S.ventes.valeur) : null}
        detail={S && S.ventes.valeur == null ? note(S.ventes) : (S && S.ventes.partiel ? tr('journee.moins') : '')} onClick={ouvrir} attrs={{ 'data-v2-stat': 'ventes' }}/>
      <Tuile libelle={tr('v2.stats.panier')} valeur={S && S.panier.valeur != null ? coupe(montant(S.panier.valeur))[0] : nul(null)} unite={S && S.panier.valeur != null ? coupe(montant(S.panier.valeur))[1] : ''}
        detail={S && S.panier.valeur == null ? note(S.panier) : ''} onClick={ouvrir} attrs={{ 'data-v2-stat': 'panier' }}/>
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
export default function Aujourdhui({ titre, pret: pretLu = true, affiche, colis = [], retraits = null, groupes = [], plein = null, Photo = null, Icon, onColis, onRetraits,
  onScanner = null, chiffres = null, alerte = null, ventes = null, aVenir = null, onVentes = null,
  objectif = null, courbe = null, comptes = null, capte = null, vrm = null, cartes = null, onMessages = null, onJournal = null }) {
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
    envoyer: () => (
      <Carte titre={tr('v2.envoyer.titre')} n={nombre(n)} sousTitre={alerteEnv ? alerte.txt : (affiche.sous || '')} tonSous={alerteEnv ? 'ambre' : 'neutre'}
        action={plein ? <Bouton variante="plein" onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n) }}>{tr('v2.imprimer', { n: plein.n })}</Bouton> : null}
        attrs={{ 'data-v2-bloc': 'envoyer', 'data-v2-groupe': 'envoyer', 'data-v2-envoyer': String(n), 'data-v2-ecart': affiche.sous || '', 'data-v2-alerte': alerteEnv ? 'poster' : undefined, 'data-v2-bande': String(montres.length) }}>
        {montres.map((c) => (
          // (19 nov.) Le titre a SA ligne (2 au plus) et le prix à droite ; dessous « N° · échéance · transporteur ».
          <Rangee key={c.cle} vignette={image(c.photo, 44)} titre={c.titre || (c.num ? 'N° ' + c.num : tr('v2.dv.vente', { site: c.site || '' }))} lignes={2} plaque={c.num ? <Plaque numero={c.num}/> : null}
            sousTitre={[c.tr, c.compte].filter(Boolean).join(' · ')} pastilleSous={c.e && c.e.txt ? <Pastille ton={c.e.ambre ? 'ambre' : 'neutre'}>{c.e.txt}</Pastille> : null}
            valeur={c.prix || ''} valeurForte onClick={() => onColis && onColis(c)} attrs={{ 'data-v2-colis': c.cle, 'data-v2-colis-presse': c.e && c.e.ambre ? '1' : undefined }}/>
        ))}
        {resteEnv > 0 ? <Rangee titre={tr('v2.bande.plus', { n: resteEnv })} fin="chevron" onClick={() => onColis && onColis(null)} attrs={{ 'data-n-plus': String(resteEnv) }}/> : null}
      </Carte>
    ),
    retirer: () => (
      <Carte titre={tr('v2.retirer.titre')} n={nombre(nRet)} tonSous={retraits.premier && retraits.premier.ambre ? 'ambre' : 'neutre'}
        sousTitre={[pts.length ? tr('v2.retirer.resume', { n: nRet, p: retraits.nPoints || 1 }) : tr('v2.retirer.resumeN', { n: nRet }), retraits.premier ? retraits.premier.txt : ''].filter(Boolean).join(' · ')}
        attrs={{ 'data-v2-bloc': 'retirer', 'data-v2-groupe': 'retirer', 'data-v2-alerte': alerte && alerte.id === 'retirer' ? 'retirer' : undefined }}>
        {ptsMontres.length ? ptsMontres.map((pt, k) => (
          <Rangee key={(pt.lieu || '?') + k} icone={<Icon name="pin" size={22}/>} titre={pt.lieu || tr('v2.retirer.pointInconnu')}
            valeur={pt.code ? <span data-v2-passe-code={pt.code}>{pt.code}</span> : ''} valeurForte fin="chevron" onClick={onRetraits}
            attrs={k === 0 ? { 'data-v2-passe-mini': '', 'data-v2-n': String(nRet), 'data-v2-passe-lieu': pt.lieu || '' } : null}/>
        )) : <Rangee icone={<Icon name="pin" size={22}/>} titre={tr('v2.retirer.codesAVenir')} fin="chevron" onClick={onRetraits} attrs={{ 'data-v2-passe-mini': '', 'data-v2-n': String(nRet), 'data-v2-passe-lieu': '' }}/>}
        {restePts > 0 ? <Rangee titre={tr('v2.retirer.autresPoints', { n: restePts })} fin="chevron" onClick={onRetraits}/> : null}
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
    // Un retour à déposer aujourd'hui ou demain n'a pas de carte à lui : UNE rangée, en fin de page.
    retour: () => (
      <Carte attrs={{ 'data-v2-bloc': 'retour' }}>
        <Rangee icone={<Icon name="restore" size={22}/>} titre={tr('v2.alerte.retourTitre')} sousTitre={alerte.txt} ton="ambre" fin="chevron" onClick={alerte.faire} attrs={{ 'data-v2-alerte': 'retour' }}/>
      </Carte>
    ),
  };
  const presents = { chiffres: !!chiffres, envoyer: n > 0, retirer: !!nRet, ventes: lignesV.length > 0 || aVenirLu, courbe: !!courbe, comptes: true, annonces: true, vrm: true, retour: !!alerte && alerte.id === 'retour' };
  // L'ordre et les cartes montrées sont LES SIENS (« Personnaliser », `vrm_aujourdhui_cartes`, synchronisé) ; avant que
  // les lectures soient là, seules les chiffres sont montrés à leur taille (rien qui saute ensuite).
  const montrees = choix.ordre.filter((k) => choix.montrees.has(k) && presents[k] && (k === 'chiffres' || pret));
  const basculer = (k) => { if (!cartes || !cartes.poser) return; const m = new Set(choix.montrees); if (m.has(k)) m.delete(k); else m.add(k); cartes.poser({ ordre: choix.ordre, montrees: CARTES_AUJOURDHUI.filter((x) => m.has(x)) }); };
  const deplacer = (k, d) => { if (!cartes || !cartes.poser) return; const o = [...choix.ordre]; const a = o.indexOf(k), b = a + d; if (a < 0 || b < 0 || b >= o.length) return; [o[a], o[b]] = [o[b], o[a]]; cartes.poser({ ordre: o, montrees: CARTES_AUJOURDHUI.filter((x) => choix.montrees.has(x)) }); };
  const enregistrerObjectif = () => { if (!objectif || !objectif.enregistrer) return; if (objectif.enregistrer(saisie)) setObjOuvert(false); else setSaisieKo(true); };
  return (
    <Page titre={titre}
      actions={onScanner ? <BoutonIcone libelle={tr('v2.scanner')} icone={<Icon name="scan" size={22}/>} onClick={onScanner} attrs={{ 'data-v2-scanner': '' }}/> : null}
      attrs={{ 'data-v2-ecran': 'aujourdhui', 'data-espace': 'journee', 'data-v2-affiche': !pret || n == null ? '' : String(n), 'data-v2-attente': pret ? undefined : '1', 'data-v2-cartes': montrees.join(',') }}>
      {/* Une grille de cartes à l'ordinateur (les chiffres en pleine largeur), la même suite au téléphone. */}
      <Colonnes>
        {montrees.map((k) => (k === 'chiffres'
          ? <Colonne key={k} pleine><Chiffres chiffres={chiffres} p={p} setP={setP} objectif={obj}/></Colonne>
          : <Colonne key={k}>{BLOCS[k]()}</Colonne>))}
        {pret && rien && !montrees.some((k) => k !== 'chiffres') ? <Colonne><Carte attrs={{ 'data-v2-bloc': 'rien', 'data-v2-rien': '' }}><Vide icone={<Icon name="check" size={40}/>} phrase={tr('v2.rien.titre')} detail={tr('v2.rien.sous')}/></Carte></Colonne> : null}
        {pret && presents.retour ? <Colonne>{BLOCS.retour()}</Colonne> : null}
        {cartes && cartes.poser ? <Colonne pleine><Bouton variante="texte" onClick={() => setPerso(true)} attrs={{ 'data-v2-perso': '' }}>{tr('v2.perso.ouvrir')}</Bouton></Colonne> : null}
      </Colonnes>
      <Feuille ouverte={perso} onFermer={() => setPerso(false)} titre={tr('v2.perso.titre')} detente="pleine">
        <Groupe pied={tr('v2.perso.pied')}>
          {choix.ordre.map((k, x) => (
            <Rangee key={k} titre={tr('v2.perso.carte.' + k)} interrupteur={{ actif: choix.montrees.has(k), onChange: () => basculer(k) }}
              actions={[...(x > 0 ? [{ cle: 'monter', libelle: tr('v2.perso.monter'), ton: 'neutre', onClick: () => deplacer(k, -1) }] : []),
                ...(x < choix.ordre.length - 1 ? [{ cle: 'descendre', libelle: tr('v2.perso.descendre'), onClick: () => deplacer(k, 1) }] : [])]}
              attrs={{ 'data-v2-perso-carte': k }}/>
          ))}
        </Groupe>
        <Groupe><Rangee titre={tr('v2.perso.defaut')} onClick={() => cartes && cartes.poser && cartes.poser({ ordre: [...CARTES_AUJOURDHUI], montrees: [...CARTES_DEFAUT] })}/></Groupe>
      </Feuille>
      <Feuille ouverte={objOuvert} onFermer={() => setObjOuvert(false)} titre={tr('v2.obj.titre')} detente="moitie"
        pied={<Bouton variante="plein" onClick={enregistrerObjectif}>{tr('v2.obj.enregistrer')}</Bouton>}>
        <Champ libelle={tr('v2.obj.libelle')} valeur={saisie} onChange={(v) => { setSaisie(v); setSaisieKo(false); }} inputMode="decimal" suffixe="€" attrs={{ 'data-v2-objectif-saisie': '' }}/>
        {saisieKo ? <Groupe pied={tr('v2.obj.invalide')}/> : null}
        {objectif && objectif.cible && objectif.retirer ? <Groupe><Rangee titre={tr('v2.obj.retirer')} onClick={() => { objectif.retirer(); setObjOuvert(false); }}/></Groupe> : null}
      </Feuille>
    </Page>
  );
}
