// ── « À RETIRER AILLEURS » (15 nov., lot retrait-ailleurs) ──────────────────────
// Julien : « le retrait d'une paire vendue sur Vinted, le retrait sur Leboncoin, hyper
// intuitif, accompagné par l'application ». UN endroit : Ma journée le pose EN TÊTE quand il
// y en a (et la notification de vente y mène) ; la fiche de la paire montre le même bloc pour
// SON N° (`numero`). La règle : src/aRetirerAilleurs.js (états, gestes) sur le plan de
// src/retirerAilleurs.js (identité seulement, jamais le titre — §5).
//
// Chaque paire : la plaque N°, la vignette, le titre, « Vendue sur Vinted » ; puis, pour
// chaque site où elle est encore en ligne : la marque du site, le compte, CE qui s'y passe
// (une phrase) et LE geste — « Retirer de Leboncoin » (extension), « Retirer d'eBay » (route),
// ou, là où VRM n'a pas de voie (Vinted — §3 —, Vestiaire, Leboncoin sans extension),
// l'annonce elle-même + « C'est retiré » sur SON clic. Rien ne part sans son toucher.
// « Tout retirer (N) » enchaîne les gestes automatiques, un par un, arrêtable.
// ⚠️ Décision de Julien (14 nov.) : aucun « Annuler 5 s », aucune confirmation NOUVELLE (la
//    confirmation de suppression Leboncoin existante reste, une fois, posée par l'écran).
import React from 'react';
import { tr, date } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import MarquePlateforme from './plateformes/Marque.jsx';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { AccAvant, AccPendant } from './ui/Accompagne.jsx';
import { SITE_MARQUE, LIEN_SITE } from './aRetirerAilleurs.js';
import './a-retirer-ailleurs.css';

const jour = (t) => (Number.isFinite(t) ? date(t, { day: 'numeric', month: 'short' }) : '');

// La phrase d'un site, selon son état (les textes : src/i18n/langues/*/retraitAilleurs.js).
export function texteSite(s) {
  const site = s.plateforme;
  switch (s.etat) {
    case 'encours': return tr('rx.e.encours');
    case 'onglet': return s.compteNom ? tr('rx.e.onglet', { compte: s.compteNom }) : tr('rx.e.ongletSansCompte');
    case 'retire': return s.relu ? tr('rx.e.retireRelu') : tr('rx.e.retire', { site });
    case 'incertain': return tr('rx.e.incertain');
    case 'refuse': return tr('rx.e.refuse', { raison: String(s.texte || '').replace(/^pas fait\s*[—:-]\s*/i, '').replace(/[.\s]+$/, '') || '—' });
    case 'note': return tr('rx.e.note', { site });
    case 'ebayAuto': return tr('rx.e.ebayAuto');
    case 'ebayEnvoye': return tr('rx.e.ebayEnvoye');
    case 'verifier':
      if (s.code === 'douteuse') return s.pourquoiCode === 'sans-etat' ? tr('rx.v.sansEtat') : tr('rx.v.douteuseSans');
      if (s.code === 'vieille') return tr('rx.v.vieille', { date: jour(s.lu) || '—' });
      return tr(`rx.v.${['remise', 'deux', 'pasConfirme'].includes(s.code) ? s.code : 'pasConfirme'}`);
    case 'aRetirer': return tr(s.moyen === 'ebay' ? 'rx.e.ebay' : 'rx.e.lbc');
    case 'main':
    default: return tr(`rx.e.${['vinted', 'vestiaire', 'sansId', 'lbcAbsente', 'lbcRetard', 'ebayHors'].includes(s.code) ? s.code : 'autre'}`);
  }
}

function Geste({ s, art, onGeste, onMarquer, occupe }) {
  const lien = s.lien || LIEN_SITE[s.plateforme] || null;
  const ouvrir = lien ? (
    <a className="sb-lien rx-lien" href={lien} target="_blank" rel="noopener noreferrer" data-rx-ouvrir={s.cle}>
      {s.lien ? tr('rx.g.ouvrir') : tr('rx.g.ouvrirSite', { site: s.plateforme })}
    </a>
  ) : null;
  if (s.etat === 'aRetirer' || s.etat === 'ebayAuto' || s.etat === 'refuse') {
    const lib = s.etat === 'refuse' ? tr('rx.g.reessayer') : s.etat === 'ebayAuto' ? tr('rx.g.maintenant') : s.moyen === 'ebay' ? tr('rx.g.ebay') : tr('rx.g.lbc');
    return <button type="button" className="sb-touche rx-geste" data-rx-geste={s.moyen} data-rx-cle={s.cle} disabled={occupe} onClick={() => onGeste && onGeste(s, art)}>{lib}</button>;
  }
  if (s.etat === 'onglet') {
    return <a className="sb-touche rx-geste" href={LIEN_SITE.Leboncoin} target="_blank" rel="noopener noreferrer" data-rx-ouvrir-lbc={s.cle}>{tr('rx.g.ouvrirLbc')}</a>;
  }
  if (s.etat === 'main') {
    return (<>
      {ouvrir}
      <button type="button" className="sb-touche rx-geste" data-rx-marquer={s.cle} disabled={occupe} onClick={() => onMarquer && onMarquer(s, art)}>{tr('rx.g.cestRetire')}</button>
    </>);
  }
  if (s.etat === 'incertain' || s.etat === 'verifier') return ouvrir;
  return null;
}

export default function ARetirerAilleurs({ liste, onGeste, onMarquer, onToutRetirer, serie = null, onArreter = null, PhotoVinted = null, numero = null, ambigus = 0, manques = [] }) {
  useLangue();
  if (!liste || !liste.articles || !liste.articles.length) return null;
  const enSerie = !!(serie && serie.total);
  const occupe = enSerie || liste.articles.some((a) => a.sites.some((s) => s.etat === 'encours'));
  const nTout = liste.serie.length;
  const fiche = numero != null;
  return (
    <section className={'rx' + (fiche ? ' is-fiche' : '')} data-retirer-ailleurs-liste="" data-rx-n={String(liste.articles.length)} data-rx-serie={String(nTout)}
      data-rx-reste={String(liste.nReste)} aria-label={tr('rx.titre')}>
      <div className="rx-entete">
        <h2 className="rx-titre">{tr('rx.titre')}</h2>
      </div>
      {!fiche ? <p className="rx-sous">{tr('rx.sous', { n: liste.articles.length })}</p> : null}
      {enSerie
        ? <AccPendant geste="annonce.retirer" fait={serie.fait} total={serie.total} onArreter={onArreter} arretDemande={!!serie.arret}/>
        : nTout ? <AccAvant geste="annonce.retirer" className="rx-avant"/> : null}
      {!fiche && nTout >= 2 && !enSerie ? (
        <div className="rx-tout-rang"><button type="button" className="sb-touche rx-tout" data-rx-tout={String(nTout)} disabled={occupe} onClick={onToutRetirer}>{tr('rx.toutRetirer', { n: nTout })}</button></div>
      ) : null}
      {liste.articles.map((art) => (
        <article key={art.numero} className="rx-article" data-ra-numero={art.numero} data-rx-douteuse={art.douteuse ? '1' : undefined}>
          {!fiche ? (
            <div className="rx-tete">
              <span className="sb-vignette rx-vignette">{art.photo && PhotoVinted ? <PhotoVinted src={art.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}</span>
              <span className="rx-tete-txt">
                <span className="rx-ligne1">
                  <span className="sb-plaque" data-rx-plaque={art.numero}><small>N°</small>{art.numero}</span>
                  <span className="rx-vendu" data-rx-vendu={art.venduSur.join(' ')}>{tr(art.douteuse ? 'rx.peutEtreVendue' : 'rx.venduSur', { site: art.venduSur.join(', ') || '—' })}</span>
                </span>
                {art.titre ? <span className="rx-nom">{art.titre}</span> : null}
              </span>
            </div>
          ) : null}
          <ul className="rx-sites">
            {art.sites.map((s) => (
              <li key={s.cle} className={'rx-site is-' + s.etat} data-rx-site={s.cle} data-rx-plateforme={s.plateforme} data-rx-etat={s.etat} data-ra-statut={s.etat === 'retire' ? (s.relu ? 'relu' : 'retire') : s.etat}
                aria-busy={s.etat === 'encours' ? 'true' : undefined}>
                <span className="rx-marque" aria-hidden="true"><MarquePlateforme site={SITE_MARQUE[s.plateforme] || ''} taille={20} carre/></span>
                <span className="rx-site-txt">
                  <b>{s.plateforme}{s.compteNom && s.compteNom !== s.plateforme ? <span className="rx-compte"> · {s.compteNom}</span> : null}</b>
                  <small data-rx-phrase="">{s.etat === 'retire' || s.etat === 'note' ? <span className="rx-ok" aria-hidden="true">✓ </span> : (s.etat === 'refuse' || s.etat === 'onglet' || s.etat === 'incertain') ? <span className="rx-point" aria-hidden="true"/> : null}{texteSite(s)}</small>
                  {s.dementieLe ? <small className="rx-dementie" data-rx-dementie="">{tr('rx.e.dementie', { date: jour(s.dementieLe) })}</small> : null}
                </span>
                <span className="rx-gestes"><Geste s={s} art={art} onGeste={onGeste} onMarquer={onMarquer} occupe={occupe}/></span>
              </li>
            ))}
          </ul>
        </article>
      ))}
      {!fiche && ambigus > 0 ? <p className="rx-note" data-ra-ambigus={String(ambigus)}>{tr('rx.ambigus', { n: ambigus })}</p> : null}
      {!fiche && manques && manques.length ? <p className="rx-note" data-ra-manques="">{tr('rx.manques', { liste: manques.join(', ') })}</p> : null}
    </section>
  );
}
