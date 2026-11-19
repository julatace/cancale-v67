// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI — « VRM natif » (docs/design/NATIF.md §4), 19 nov. Décisions de Julien, mot pour mot :
//    « le visuel de l'app doit être absolument parfait » ; « tout ça ne sert à rien, ça doit être rangé dans les
//    onglets dédiés justement à ça […] il y a d'autres choses plus intéressantes pour cet onglet » ; « l'outil doit
//    être pratique, pas chiant » ; « je veux quelque chose de drastique, nouveau, totalement différent ».
//  ⇒ PAS DE LISTE « À FAIRE » ICI : ses groupes sont PUBLIÉS (src/designV2/aRegler.js) et se lisent en tête de LEUR
//    onglet (« À régler »). Ne pas la remettre sur cet écran.
//  De haut en bas — ce qu'il regarde chaque matin, rien qui le gronde :
//    1. l'affiche : le vendu du jour (« — » si pas su, jamais 0 pour « pas su ») et les 7 jours en barres ;
//    2. le mois : Vendu · Reçu · Bénéfice (un bénéfice brut dit sa couverture, jamais « au moins ») ;
//    3. « À envoyer » : le nombre, des vignettes nettes (chacune SA plaque, « +N » pour le reste) ; LE plein
//       « Imprimer N bordereaux » est celui de la page (collé en bas) ;
//    4. « À retirer » : le point sur une ligne, le code en grand ;
//    5. « Dernières ventes » (5) et « Argent à venir » s'il y en a.
//  Au plus UNE alerte (une date limite LUE qui tombe aujourd'hui ou demain), dite DANS le groupe qu'elle concerne.
//  Écran natif : il COMPOSE les composants de src/natif/ — ni style en ligne, ni classe de mise en page, ni couleur.
//  AUCUNE règle ici : tout arrive calculé (src/aujourdhui/modele.js, les cartes de Ma journée dans src/App.jsx).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre, localeCourante } from '../../i18n/index.js';
import { Page, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Affiche, Faits, Fait, Vide, Barres, Vignettes, CodeRetrait, Colonnes, Colonne } from '../index.js';
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

// L'AFFICHE et LE MOIS. `chiffres` : { etat: 'encours' | 'passu' | 'lu', raison, jours: [{ cle, lettre, long, court, v, n,
// partiel, auj }], montre (le rang du jour dit par défaut : `jourMontre`), mois: { nom, vendu, recu, benefice }, montant, onArgent }.
// La boîte a la MÊME forme dans les trois états (« — » et sa raison) : rien ne bouge quand le chiffre arrive.
function Chiffres({ chiffres }) {
  const { etat = 'encours', raison = '', jours = [], montre = -1, mois = null, montant = (x) => String(x), onArgent = null } = chiffres;
  const [choix, setChoix] = React.useState(null);
  const auto = montre >= 0 && montre < jours.length ? montre : jours.length - 1;
  const i = choix == null || choix >= jours.length ? auto : choix;
  const j = jours[i] || null, auj = jours.length ? jours[jours.length - 1] : null;
  const lu = etat === 'lu' && !!j && j.v != null;
  const [n, u] = lu ? coupe(montant(j.v)) : [null, ''];
  const quand = !j ? '' : j.auj ? tr('v2.jour.auj') : i === jours.length - 2 ? tr('v2.jour.hier') : tr('v2.jour.le', { quand: j.court });
  const mot = etat === 'encours' ? tr('v2.jour.lecture') : !lu ? (raison || (j && j.raison) || tr('v2.jour.pasSu'))
    : (j.partiel ? tr('journee.moins') + ' · ' : '') + tr('v2.jour.vendus', { n: j.v, quand }) + (j.n != null ? ' · ' + (j.n === 0 ? tr('v2.jour.aucune') : tr('v2.jour.ventes', { n: j.n })) : '');
  const fait = (cle, libelle, x) => {
    const su = !!x && x.valeur != null;
    const detail = !x ? '' : !su ? (x.note || '') : x.couverture ? tr('v2.mois.sur', { n: x.couverture.n, k: x.couverture.k }) : x.partiel ? tr('journee.moins') : (x.note || '');
    return <Fait key={cle} libelle={libelle} valeur={su ? montant(x.valeur) : null} detail={detail} onModifier={onArgent}
      attrs={{ 'data-v2-mois': cle, 'data-v2-mois-cents': su ? cents(x.valeur) : '', 'data-v2-mois-partiel': su && x.partiel ? '1' : undefined, 'data-v2-mois-brut': x && x.couverture ? '1' : undefined }}/>;
  };
  return (<>
    <Groupe attrs={{ 'data-v2-bloc': 'chiffres', 'data-v2-chiffres': etat, 'aria-busy': etat === 'encours' ? 'true' : undefined,
      'data-v2-jour-vendu': etat === 'lu' && auj && auj.v != null ? cents(auj.v) : '', 'data-v2-jour-ventes': etat === 'lu' && auj && auj.n != null ? String(auj.n) : '', 'data-v2-jour-montre': j ? j.cle : '' }}>
      <Affiche valeur={n} unite={u} libelle={mot}>
        <Barres libelle={tr('journee.septDerniersJours')} choisie={i} onChoisir={setChoix}
          barres={jours.map((x) => ({ cle: x.cle, lettre: x.lettre, libelle: x.long + (etat === 'lu' && x.v != null ? ' · ' + montant(x.v) : ''), valeur: etat === 'lu' ? x.v : null }))}
          attrs={{ 'data-v2-semaine': jours.map((x) => (etat === 'lu' ? cents(x.v) : '')).join(',') }}/>
      </Affiche>
    </Groupe>
    {mois ? (
      <Groupe titre={mois.nom} attrs={{ 'data-v2-bloc': 'mois' }}>
        <Faits colonnes={3}>
          {fait('vendu', tr('v2.mois.vendu'), mois.vendu)}
          {fait('recu', tr('v2.mois.recu'), mois.recu)}
          {fait('benefice', mois.benefice && mois.benefice.libelle ? mois.benefice.libelle : tr('v2.mois.benefice'), mois.benefice)}
        </Faits>
      </Groupe>
    ) : null}
  </>);
}

// `pret` : les lectures dont dépend l'écran sont arrivées (à envoyer ET à retirer). Avant : l'affiche et le mois à leur
// taille, RIEN d'autre — puis les groupes arrivent d'un coup, à leur place (17 nov., Julien : « quand ça charge tout bouge
// bizarrement » : aucun bloc qui apparaît puis s'en va, aucun ordre qui change).
export default function Aujourdhui({ titre, pret: pretLu = true, affiche, colis = [], retraits = null, groupes = [], plein = null, Photo = null, Icon, onColis, onRetraits,
  onScanner = null, chiffres = null, alerte = null, ventes = null, aVenir = null, onVentes = null }) {
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
  const ordre = React.useRef([]);
  const BLOCS = {
    envoyer: () => (
      <Groupe titre={tr('v2.envoyer.titre')} pied={alerte && alerte.id === 'poster' ? (affiche.sous || '') : ''} attrs={{ 'data-v2-bloc': 'envoyer', 'data-v2-groupe': 'envoyer' }}>
        {/* L'alerte (au plus UNE sur l'écran) est dite ICI, dans le groupe qu'elle concerne ; l'écart passe alors au pied. */}
        <Rangee titre={nombre(n) + ' ' + tr('v2.aEnvoyer.mot', { n })} sousTitre={alerte && alerte.id === 'poster' ? alerte.txt : (affiche.sous || '')} ton={alerte && alerte.id === 'poster' ? 'ambre' : 'neutre'}
          fin="chevron" onClick={() => onColis && onColis(null)}
          attrs={{ 'data-v2-envoyer': String(n), 'data-v2-ecart': affiche.sous || '', 'data-v2-alerte': alerte && alerte.id === 'poster' ? 'poster' : undefined }}/>
        <Vignettes libelle={tr('v2.bande.aria')} total={n} Image={Photo} icone={<Icon name="cintre" size={22}/>} libellePlus={(k) => tr('v2.bande.plus', { n: k })} onPlus={() => onColis && onColis(null)}
          elements={colis.map((c) => ({ cle: c.cle, src: c.photo || '', numero: c.num || '', presse: !!(c.e && c.e.ambre), libelle: [c.num ? 'N° ' + c.num : '', c.titre, c.prix, c.e && c.e.txt].filter(Boolean).join(' · '), onClick: () => onColis && onColis(c) }))}
          attrs={{ 'data-v2-bande': String(colis.length) }} attrsCase={(e) => ({ 'data-v2-colis': e.cle, 'data-v2-colis-presse': e.presse ? '1' : undefined })}/>
      </Groupe>
    ),
    retirer: () => (
      <Groupe titre={tr('v2.retirer.titre')} attrs={{ 'data-v2-bloc': 'retirer', 'data-v2-groupe': 'retirer' }}>
        <Rangee icone={<Icon name="pin" size={22}/>} titre={point ? (point.lieu || tr('v2.retirer.pointInconnu')) : tr('v2.retirer.codesAVenir')}
          sousTitre={[point ? tr('v2.retirer.resume', { n: nRet, p: retraits.nPoints || 1 }) : tr('v2.retirer.resumeN', { n: nRet }), retraits.premier ? retraits.premier.txt : ''].filter(Boolean).join(' · ')}
          ton={retraits.premier && retraits.premier.ambre ? 'ambre' : 'neutre'} fin="chevron" onClick={onRetraits}
          attrs={{ 'data-v2-passe-mini': '', 'data-v2-n': String(nRet), 'data-v2-passe-lieu': point ? (point.lieu || '') : '', 'data-v2-alerte': alerte && alerte.id === 'retirer' ? 'retirer' : undefined }}/>
        {point && point.code ? <CodeRetrait code={point.code} onClick={onRetraits} libelle={tr('v2.retirer.voir')} attrs={{ 'data-v2-passe-code': point.code }}/> : null}
      </Groupe>
    ),
    ventes: () => (
      <Groupe titre={tr('v2.dv.titre')} attrs={{ 'data-v2-bloc': 'ventes', 'data-v2-dernieres': String(lignesV.length) }}>
        {lignesV.map((l) => (
          <Rangee key={l.cle} vignette={image(l.photo, 44)} titre={l.titre || tr('v2.dv.vente', { site: l.site })} plaque={l.num ? <Plaque numero={l.num}/> : null}
            sousTitre={[l.site, ilYaCourt(l.ts)].filter(Boolean).join(' · ')} valeur={l.prix} valeurForte onClick={l.ouvrir || onVentes} attrs={{ 'data-v2-vente': l.cle }}/>
        ))}
        {aVenirLu ? <Rangee titre={tr('v2.dv.aVenir')} valeur={(aVenir.partiel ? tr('journee.moins') + ' ' : '') + aVenir.texte} fin="chevron" onClick={aVenir.ouvrir} attrs={{ 'data-v2-avenir': cents(aVenir.valeur) }}/> : null}
      </Groupe>
    ),
    // Un retour à déposer aujourd'hui ou demain n'a pas de groupe à lui sur cet écran : UNE rangée, en fin de page.
    retour: () => (
      <Groupe attrs={{ 'data-v2-bloc': 'retour' }}>
        <Rangee icone={<Icon name="restore" size={22}/>} titre={tr('v2.alerte.retourTitre')} sousTitre={alerte.txt} ton="ambre" fin="chevron" onClick={alerte.faire} attrs={{ 'data-v2-alerte': 'retour' }}/>
      </Groupe>
    ),
  };
  const presents = { envoyer: n > 0, retirer: !!nRet, ventes: lignesV.length > 0 || aVenirLu, retour: !!alerte && alerte.id === 'retour' };
  if (pret) for (const k of ['envoyer', 'retirer', 'ventes', 'retour']) if (presents[k] && !ordre.current.includes(k)) ordre.current.push(k);
  return (
    <Page titre={titre}
      actions={onScanner ? <BoutonIcone libelle={tr('v2.scanner')} icone={<Icon name="scan" size={22}/>} onClick={onScanner} attrs={{ 'data-v2-scanner': '' }}/> : null}
      plein={pret && plein ? <Bouton variante="plein" onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n), 'data-v2-pouce': '' }}>{tr('v2.imprimer', { n: plein.n })}</Bouton> : null}
      attrs={{ 'data-v2-ecran': 'aujourdhui', 'data-espace': 'journee', 'data-v2-affiche': !pret || n == null ? '' : String(n), 'data-v2-attente': pret ? undefined : '1' }}>
      {/* Trois colonnes à l'ordinateur (les chiffres · ce qui part et ce qui arrive · les dernières ventes) ; au téléphone
          elles s'effacent et tout se suit, dans cet ordre. */}
      <Colonnes>
        <Colonne>{chiffres ? <Chiffres chiffres={chiffres}/> : null}</Colonne>
        <Colonne>
          {pret && rien ? <Groupe attrs={{ 'data-v2-bloc': 'rien', 'data-v2-rien': '' }}><Vide icone={<Icon name="check" size={40}/>} phrase={tr('v2.rien.titre')} detail={tr('v2.rien.sous')}/></Groupe> : null}
          {pret ? ordre.current.filter((k) => presents[k] && k !== 'ventes').map((k) => <React.Fragment key={k}>{BLOCS[k]()}</React.Fragment>) : null}
        </Colonne>
        <Colonne>{pret && presents.ventes ? BLOCS.ventes() : null}</Colonne>
      </Colonnes>
    </Page>
  );
}
