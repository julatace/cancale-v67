// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI — refait le 19 nov. (deux décisions de Julien, mot pour mot) :
//    « ça ne me convient toujours pas, je veux que tout soit beaucoup mieux, le visuel de l'app doit être absolument
//      parfait » (sa capture : bande de photos empilées, bouton délavé, passe cassée, barre déséquilibrée) ;
//    « honnêtement tout ça ne sert à rien, ça doit être rangé dans les onglets dédiés justement à ça […] je pense qu'il
//      y a d'autres choses plus intéressantes pour cet onglet » — puis « l'outil doit être pratique, pas chiant ».
//  ⇒ LA LISTE « À FAIRE » N'EST PLUS ICI : chaque groupe est publié (src/designV2/aRegler.js) et se lit dans SON
//    onglet (« À régler », src/designV2/ARegler.jsx). Ne pas la remettre sur cet écran.
//  L'écran, de haut en bas — ce qu'il regarde chaque matin, rien qui le gronde :
//    1. le titre, et AU PLUS UNE ligne ambre si une date limite LUE tombe aujourd'hui ou demain ;
//    2. les chiffres : vendu du jour (« — » si pas su, jamais 0 pour « pas su »), les 7 jours, le mois ;
//    3. « À envoyer » : le nombre, des vignettes nettes (chacune SA plaque N°, au plus un point d'urgence, le reste
//       résumé « +N »), et LE plein « Imprimer les bordereaux » ;
//    4. « À retirer » : la passe (le point sur une ligne, le code en grand, « N colis · N points », l'urgence) ;
//    5. « Dernières ventes » (5) et, si c'est lu, « Argent à venir » sur une ligne.
//  AUCUNE règle ici : tout arrive calculé par Ma journée (src/App.jsx, `Comptabilite only="journee"`) et par les
//  propriétaires des chiffres (`valeurChiffre`, la ligne publiée par Ventes) — ce composant choisit, range et nomme.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre, localeCourante } from '../i18n/index.js';
import { BoutonV2, BoutonIconeV2, RangeeTouchable } from './BoutonV2.jsx';
import './design-v2.css';
import './aujourdhui.css';
import { Etiquette } from './Signature.jsx';
import { publierARegler } from './aRegler.js';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
// « 1 107 € » ⇒ [« 1 107 », « € »] : le symbole plus petit, collé au chiffre.
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

function RienAFaire({ compact = false }) {
  return (
    <section className={'v2-rien' + (compact ? ' is-compact' : '')} data-v2-rien="" aria-label={tr('v2.rien.titre')}>
      {compact ? null : (
        <svg className="v2-rien-dessin" width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
          <path d="M18 38 L60 22 L102 38 L60 54 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M18 38 V70 L60 86 V54 M102 38 V70 L60 86" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M39 30 L81 46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5"/>
        </svg>
      )}
      <h2 className="v2-rien-titre">{tr('v2.rien.titre')}</h2>
      <p className="v2-rien-sous">{tr('v2.rien.sous')}</p>
    </section>
  );
}

// ── 2. LES CHIFFRES : le jour, les 7 jours, le mois ──────────────────────────
// `jours` : 7 entrées, la plus ancienne d'abord — { cle, lettre, long, v (€ | null = pas su), n (ventes | null), auj }.
// `etat` : 'encours' (la boîte, à sa taille) · 'passu' (« — » et `raison`) · 'lu'.
// `mois` : { nom, vendu, recu, benefice } — chacun { valeur | null, partiel, note } ; `benefice.couverture` = { k, n }
//          quand c'est le brut des ventes au prix connu (jamais « au moins » devant un bénéfice, §5).
export function ChiffresDuJour({ etat = 'encours', raison = '', jours = [], montre = -1, mois = null, montant = (x) => String(x), onArgent = null, Icon }) {
  const auj = jours.length ? jours[jours.length - 1] : null;
  // Le jour montré : aujourd'hui s'il a vendu, sinon le dernier des sept où il a vendu (le dernier chiffre utile),
  // sinon aujourd'hui ; un toucher sur une barre choisit son jour.
  // (la règle : `jourMontre`, src/aujourdhui/modele.js)
  const auto = montre >= 0 && montre < jours.length ? montre : jours.length - 1;
  const [choix, setChoix] = React.useState(null);
  const i = choix == null || choix >= jours.length ? auto : choix;
  const j = jours[i] || null;
  const max = Math.max(0, ...jours.map((x) => (x.v > 0 ? x.v : 0)));
  const lu = etat === 'lu' && j;
  const [n, u] = lu && j.v != null ? coupe(montant(j.v)) : ['—', ''];
  const quand = !j ? '' : j.auj ? tr('v2.jour.auj') : i === jours.length - 2 ? tr('v2.jour.hier') : tr('v2.jour.le', { quand: j.court });
  const mot = etat === 'encours' ? ' ' : !lu || j.v == null ? (raison || tr('v2.jour.pasSu'))
    : (j.partiel ? tr('journee.moins') + ' · ' : '') + tr('v2.jour.vendus', { n: j.v, quand }) + (j.n != null ? ' · ' + (j.n === 0 ? tr('v2.jour.aucune') : tr('v2.jour.ventes', { n: j.n })) : '');
  const cellule = (cle, lib, x) => {
    const val = x && x.valeur != null;
    const note = !x ? '' : !val ? (x.note || tr('v2.jour.pasSu')) : x.couverture ? tr('v2.mois.sur', { k: x.couverture.k, n: x.couverture.n }) : x.partiel ? tr('journee.moins') : (x.note || '');
    return (
      <span className="aj-mois-case" data-v2-mois={cle} data-v2-mois-cents={val ? cents(x.valeur) : ''} data-v2-mois-partiel={val && x.partiel ? '1' : undefined} data-v2-mois-brut={x && x.couverture ? '1' : undefined}>
        <span className="aj-mois-l">{lib}</span>
        <b className="aj-mois-v">{val ? montant(x.valeur) : '—'}</b>
        <span className="aj-mois-note">{note || ' '}</span>
      </span>
    );
  };
  return (
    <section className="aj-chiffres" data-v2-bloc="chiffres" data-v2-chiffres={etat} aria-busy={etat === 'encours' ? 'true' : undefined} aria-label={tr('v2.jour.aria')}
      data-v2-jour-vendu={etat === 'lu' && auj && auj.v != null ? cents(auj.v) : ''} data-v2-jour-ventes={etat === 'lu' && auj && auj.n != null ? String(auj.n) : ''} data-v2-jour-montre={j ? j.cle : ''}>
      <div className="aj-jour">
        <b className="aj-jour-n" data-v2-jour-n={lu && j.v != null ? cents(j.v) : ''}>{etat === 'encours' ? <span className="aj-attente" aria-hidden="true"/> : <>{n}{u ? <span className="aj-jour-u">{' ' + u}</span> : null}</>}</b>
        <span className="aj-jour-mot" data-v2-jour-mot="">{mot}</span>
      </div>
      <ol className="aj-semaine" aria-label={tr('journee.septDerniersJours')} data-v2-semaine={jours.map((x) => (etat === 'lu' ? cents(x.v) : '')).join(',')}>
        {jours.map((x, k) => {
          const h = etat === 'lu' && x.v > 0 && max > 0 ? Math.max(8, Math.round((x.v / max) * 100)) : 0;
          const nom = x.long + (etat === 'lu' && x.v != null ? ' · ' + montant(x.v) : '');
          return (
            <li key={x.cle} className="aj-sem-jour">
              <button type="button" className="aj-sem-btn" aria-pressed={k === i} aria-label={nom} title={nom} data-v2-sem-jour={x.cle} data-auj={x.auj ? '' : undefined} onClick={() => setChoix(k)}>
                <span className="aj-sem-piste" aria-hidden="true"><i style={{ height: h ? h + '%' : undefined }} data-vide={h ? undefined : ''}/></span>
                <span className="aj-sem-l" aria-hidden="true">{x.lettre}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {mois ? (
        <RangeeTouchable className="aj-mois" onClick={onArgent} label={tr('v2.mois.aria', { mois: mois.nom })} attrs={{ 'data-v2-mois-ligne': '' }}>
          <span className="aj-mois-tete"><span className="aj-mois-nom">{mois.nom}</span>{Icon ? <Icon name="chevron" size={14}/> : null}</span>
          <span className="aj-mois-cases">
            {cellule('vendu', tr('v2.mois.vendu'), mois.vendu)}
            {cellule('recu', tr('v2.mois.recu'), mois.recu)}
            {cellule('benefice', mois.benefice && mois.benefice.libelle ? mois.benefice.libelle : tr('v2.mois.benefice'), mois.benefice)}
          </span>
        </RangeeTouchable>
      ) : null}
    </section>
  );
}

// ── 3. LA BANDE DES COLIS : des vignettes nettes, jamais empilées ─────────────
// Le nombre de cases qui TIENNENT est mesuré (largeur de la bande) ; ce qui ne tient pas se résume « +N ».
const CASE = 60, ECART = 8;
function BandeColis({ colis, n, Photo, Icon, onColis }) {
  const [cases, setCases] = React.useState(5);
  const mesurer = React.useCallback((el) => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const poser = () => { const w = el.clientWidth; if (w > 0) setCases(Math.max(2, Math.min(12, Math.floor((w + ECART) / (CASE + ECART))))); };
    poser(); try { new ResizeObserver(poser).observe(el); } catch (_) {}
  }, []);
  const total = Math.max(n || 0, colis.length);
  const montrees = total > cases ? cases - 1 : total;
  const reste = total - montrees;
  return (
    <div className="aj-bande" role="list" aria-label={tr('v2.bande.aria')} data-v2-bande={String(Math.min(colis.length, montrees))} data-v2-bande-reste={String(reste)} ref={mesurer}>
      {Array.from({ length: montrees }, (_, k) => {
        const c = colis[k];
        // Compté mais pas encore décrit : la même case, vide, à la même taille (jamais un saut).
        if (!c) return <span key={'a' + k} className="aj-case aj-case-attente" role="listitem" aria-hidden="true"><span className="aj-case-photo"/><span className="aj-case-plaque"/></span>;
        return (
          <RangeeTouchable key={c.cle} className="aj-case" onClick={() => onColis && onColis(c)} label={[c.num ? 'N° ' + c.num : '', c.titre, c.prix, c.e && c.e.txt].filter(Boolean).join(' · ')}
            attrs={{ role: 'listitem', 'data-v2-colis': c.cle, 'data-v2-colis-presse': c.e && c.e.ambre ? '1' : undefined }}>
            <span className="aj-case-photo">{c.photo && Photo ? <Photo src={c.photo} alt="" loading="lazy" decoding="async" width={CASE} height={CASE}/> : <Icon name="cintre" size={22}/>}
              {c.e && c.e.ambre ? <i className="aj-case-point" aria-hidden="true"/> : null}</span>
            <span className="aj-case-plaque">{c.num ? <Etiquette num={c.num}/> : null}</span>
          </RangeeTouchable>
        );
      })}
      {reste > 0 ? (
        <RangeeTouchable className="aj-case aj-case-plus" onClick={() => onColis && onColis(null)} label={tr('v2.bande.plus', { n: reste })} attrs={{ role: 'listitem', 'data-v2-colis-plus': String(reste) }}>
          <span className="aj-case-photo" aria-hidden="true">+{nombre(reste)}</span><span className="aj-case-plaque" aria-hidden="true"/>
        </RangeeTouchable>
      ) : null}
    </div>
  );
}

// `pret` : les lectures dont dépend l'écran sont arrivées (à envoyer ET à retirer). Avant : le titre et les chiffres à
// leur taille, RIEN d'autre — puis les blocs arrivent d'un coup, à leur place (17 nov., Julien : « quand ça charge tout
// bouge bizarrement » : aucun bloc qui apparaît puis s'en va, aucun ordre qui change, chaque boîte à sa taille).
export default function Aujourdhui({ affiche, colis = [], retraits = null, groupes = [], plein = null, Photo, Icon, onColis, onRetraits, onScanner = null, titre, pret: pretLu = true,
  chiffres = null, alerte = null, ventes = null, aVenir = null, onVentes = null }) {
  // Prêt une fois, prêt pour de bon (une relecture ne remet pas l'écran en attente) ; une lecture qui ne répond pas
  // n'enferme pas l'écran : au bout de 10 s, il se montre tel qu'il est (« — » là où ce n'est pas su).
  const dejaPret = React.useRef(false);
  const [delai, setDelai] = React.useState(false);
  React.useEffect(() => { if (pretLu) return undefined; const t = setTimeout(() => setDelai(true), 10000); return () => clearTimeout(t); }, [pretLu]);
  if (pretLu || delai) dejaPret.current = true;
  const pret = dejaPret.current;
  // ⚠️ (19 nov.) « À FAIRE » QUITTE CET ÉCRAN : ses groupes sont PUBLIÉS pour leurs onglets (Ventes, Achats, Annonces,
  // Stock, « Tout va bien ? »), chacun avec son geste. Publié seulement une fois les lectures arrivées (« pas su » ne
  // vaut pas « rien » : une liste encore vide n'efface pas la publication précédente).
  React.useEffect(() => { if (pret && pretLu) publierARegler(groupes); });
  const n = affiche && !affiche.pasSu ? affiche.n : null;
  const nRet = retraits && !retraits.pasSu ? retraits.n : null;
  const rien = pret && n === 0 && nRet === 0;
  const premierPoint = retraits && Array.isArray(retraits.points) ? retraits.points[0] : null;
  const lignesV = ventes && ventes.etat === 'lu' && Array.isArray(ventes.lignes) ? ventes.lignes.slice(0, 5) : [];
  const aVenirLu = aVenir && aVenir.valeur != null;
  // LES BLOCS, dans l'ORDRE DE LEUR ARRIVÉE : l'ordre voulu (à envoyer, à retirer, dernières ventes) quand tout est lu
  // ensemble ; un bloc lu plus tard se pose à la fin, jamais au-dessus d'un autre (rien ne pousse ce que l'œil lit).
  const ordreBlocs = React.useRef([]);
  const BLOCS = {
    envoyer: () => (
      <section className="aj-section" data-v2-bloc="envoyer" data-v2-groupe="envoyer" aria-label={tr('v2.aEnvoyer.aria', { n: String(n) })}>
        <h2 className="aj-h2">{tr('v2.envoyer.titre')}</h2>
        <div className="aj-carte">
          <RangeeTouchable className="aj-envoyer-tete" onClick={() => onColis && onColis(null)} attrs={{ 'data-v2-envoyer': String(n) }}>
            <b className="aj-n" data-v2-envoyer-n={String(n)}>{nombre(n)}</b>
            <span className="aj-n-txt">
              <span className="aj-n-mot">{tr('v2.aEnvoyer.mot', { n })}</span>
              {affiche.sous ? <span className={'aj-n-sous' + (affiche.ambre ? ' is-ambre' : '')} data-v2-ecart="">{affiche.sous}</span> : null}
            </span>
            <span className="aj-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
          </RangeeTouchable>
          <BandeColis colis={colis} n={n} Photo={Photo} Icon={Icon} onColis={onColis}/>
          {/* LE plein de l'écran (un seul) : dans la carte de ce qu'il imprime, jamais posé sur le contenu. */}
          {plein ? (
            <div className="aj-plein" data-v2-pouce="">
              <BoutonV2 role="principal" plein n={plein.n} icone={<Icon name="printer" size={22}/>} onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n) }}>{plein.txt}</BoutonV2>
            </div>
          ) : null}
        </div>
      </section>
    ),
    retirer: () => (
      <section className="aj-section" data-v2-bloc="retirer" data-v2-groupe="retirer" aria-label={tr('v2.retirer.titre')}>
        <h2 className="aj-h2">{tr('v2.retirer.titre')}</h2>
        <RangeeTouchable className="aj-passe" onClick={onRetraits} label={tr('v2.retirer.voir')} attrs={{ 'data-v2-passe-mini': '' }}>
          <span className="aj-passe-lieu">
            <span className="aj-passe-ic" aria-hidden="true"><Icon name="pin" size={18}/></span>
            <span className="aj-passe-nom" data-v2-passe-lieu="">{premierPoint ? (premierPoint.lieu || tr('v2.retirer.pointInconnu')) : tr('v2.retirer.codesAVenir')}</span>
            <span className="aj-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
          </span>
          {premierPoint && premierPoint.code ? <b className="aj-passe-code" data-v2-passe-code="">{premierPoint.code}</b> : null}
          <span className="aj-passe-bas">
            <span data-v2-n={String(nRet)}>{premierPoint ? tr('v2.retirer.resume', { n: nRet, p: retraits.nPoints || 1 }) : tr('v2.retirer.resumeN', { n: nRet })}</span>
            {retraits.premier ? <span className={'aj-passe-quand' + (retraits.premier.ambre ? ' is-ambre' : '')} data-v2-passe-urgence={retraits.premier.ambre ? '1' : '0'}>{retraits.premier.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{retraits.premier.txt}</span> : null}
          </span>
        </RangeeTouchable>
      </section>
    ),
    ventes: () => (
      <section className="aj-section" data-v2-bloc="ventes" aria-label={tr('v2.dv.titre')}>
        <h2 className="aj-h2">{tr('v2.dv.titre')}</h2>
        <div className="aj-liste" data-v2-dernieres={String(lignesV.length)}>
          {lignesV.map((l) => (
            <RangeeTouchable key={l.cle} className="aj-vente" onClick={l.ouvrir || onVentes} attrs={{ 'data-v2-vente': l.cle }}>
              <span className="aj-vente-photo" aria-hidden="true">{l.photo && Photo ? <Photo src={l.photo} alt="" loading="lazy" decoding="async" width={48} height={48}/> : <Icon name="cintre" size={20}/>}</span>
              <span className="aj-vente-txt">
                <span className="aj-vente-titre">{l.titre || tr('v2.dv.vente', { site: l.site })}</span>
                <span className="aj-vente-meta">{l.num ? <Etiquette num={l.num}/> : null}<span className="aj-vente-quand">{[l.site, ilYaCourt(l.ts)].filter(Boolean).join(' · ')}</span></span>
              </span>
              <b className="aj-vente-prix">{l.prix}</b>
            </RangeeTouchable>
          ))}
          {aVenirLu ? (
            <RangeeTouchable className="aj-avenir" onClick={aVenir.ouvrir} attrs={{ 'data-v2-avenir': cents(aVenir.valeur) }}>
              <span className="aj-avenir-l">{tr('v2.dv.aVenir')}</span>
              <b className="aj-avenir-v">{aVenir.partiel ? <small>{tr('journee.moins')} </small> : null}{aVenir.texte}</b>
              <span className="aj-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
            </RangeeTouchable>
          ) : null}
        </div>
      </section>
    ),
  };
  const presents = { envoyer: n > 0, retirer: !!nRet, ventes: lignesV.length > 0 || !!aVenirLu };
  if (pret) for (const k of ['envoyer', 'retirer', 'ventes']) if (presents[k] && !ordreBlocs.current.includes(k)) ordreBlocs.current.push(k);
  const blocs = ordreBlocs.current.filter((k) => presents[k]).map((k) => <React.Fragment key={k}>{BLOCS[k]()}</React.Fragment>);
  return (
    <div className="v2-ecran aj" data-v2-ecran="aujourdhui" data-espace="journee" data-v2-plein="0" data-v2-affiche={!pret || n == null ? '' : String(n)} data-v2-attente={pret ? undefined : '1'}>
      <div className="aj-hero">
        <header className="v2-tete aj-tete">
          <h1 className="v2-titre aj-titre">{titre}</h1>
          {/* Le « Scanner » du disque d'hier : un code-barres de colis ⇒ SA vente ou SON achat (le même scanner). */}
          {onScanner ? <BoutonIconeV2 icone={<Icon name="scan" size={22}/>} label={tr('v2.scanner')} onClick={onScanner} attrs={{ 'data-v2-scanner': '' }}/> : null}
        </header>
        {/* AU PLUS UNE ligne : une date limite LUE qui tombe aujourd'hui ou demain. Elle ouvre son onglet. */}
        {pret && alerte ? (
          <RangeeTouchable className="aj-alerte" onClick={alerte.faire} attrs={{ 'data-v2-alerte': alerte.id || '' }}>
            <i className="v2-point" aria-hidden="true"/><span className="aj-alerte-txt">{alerte.txt}</span><span className="aj-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
          </RangeeTouchable>
        ) : null}
        {chiffres}
      </div>
      {!pret ? null : <>
        {rien ? <div data-v2-bloc="rien"><RienAFaire compact={!!chiffres}/></div> : null}
        {blocs}
      </>}
    </div>
  );
}
