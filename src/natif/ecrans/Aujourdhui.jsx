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
import { Page, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Affiche, Faits, Fait, Vide, Segmente, Vignettes, CodeRetrait, Colonnes, Colonne } from '../index.js';
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
function Chiffres({ chiffres }) {
  const { etat = 'encours', raison = '', stats = null, mois = null, moisAvant = '', montant = (x) => String(x), ouvrirPeriode = null } = chiffres;
  const [p, setP] = React.useState('jour');
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
  const place = (t) => t || '\u00a0';
  return (<>
    <Segmente libelle={tr('v2.stats.periode')} valeur={p} onChange={setP} options={PERIODES.map((k) => ({ cle: k, libelle: tr('v2.stats.' + k) }))}/>
    <Groupe attrs={{ 'data-v2-bloc': 'chiffres', 'data-v2-chiffres': etat, 'data-v2-periode': p, 'data-v2-stats': resume, 'aria-busy': etat === 'encours' ? 'true' : undefined,
      'data-v2-jour-vendu': etat === 'lu' && stats ? cents(stats.jour.vendu.valeur) : '', 'data-v2-jour-ventes': etat === 'lu' && stats && stats.jour.ventes.valeur != null ? String(stats.jour.ventes.valeur) : '' }}>
      <Affiche valeur={n} unite={u} libelle={libelle} ecart={place(ecart)}/>
      <Faits colonnes={3}>
        <Fait libelle={B && B.brut ? tr('v2.stats.beneficeBrut') : tr('v2.stats.benefice')} valeur={B && B.valeur != null ? montant(B.valeur) : null} detail={place(detailB)} onModifier={ouvrir}
          attrs={{ 'data-v2-stat': 'benefice' }}/>
        <Fait libelle={tr('v2.stats.ventes')} valeur={S && S.ventes.valeur != null ? nombre(S.ventes.valeur) : null} detail={place(S && S.ventes.valeur == null ? note(S.ventes) : (S && S.ventes.partiel ? tr('journee.moins') : ''))} onModifier={ouvrir}
          attrs={{ 'data-v2-stat': 'ventes' }}/>
        <Fait libelle={tr('v2.stats.panier')} valeur={S && S.panier.valeur != null ? montant(S.panier.valeur) : nul(null)} detail={place(S && S.panier.valeur == null ? note(S.panier) : '')} onModifier={ouvrir}
          attrs={{ 'data-v2-stat': 'panier' }}/>
      </Faits>
    </Groupe>
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
