// ════════════════════════════════════════════════════════════════════════════
//  TES COMPTES, EN LISTE GROUPÉE (22 nov., chantier style-clarte) — la feuille « Ce que VRM peut faire depuis cette page ».
//  Julien (capture de la prod, 22 nov.) : la liste des comptes était « moche et pas visuelle » — 16 lignes de texte plat
//  (« julatace35260 Vinted — relu il y a 3 j · ouvre vinted.fr connecté sur ce compte dans ce Chrome » en ambre) ; « dis-toi
//  que tout le monde doit pouvoir comprendre ». Maintenant :
//    · trois groupes, dans cet ordre : « À relire » (un geste à faire : ambre), « À jour », « Bannis et masqués » (replié) ;
//    · une rangée = le logo du site, le pseudo, une étiquette SEULEMENT quand il y a quelque chose à faire ou à savoir,
//      l'âge de la dernière lecture à droite (chiffres alignés) ; une rangée « à relire » se touche et ouvre le bon site ;
//    · des mots simples (« Vinted a banni ce compte », « Jamais lu », « Ouvrir vinted.fr ») — `tr()`, cinq langues.
//  PRÉSENTATIONNEL : les lignes arrivent rangées par `lignesFraicheur` (src/fraicheurComptes.js, la règle de Comptes
//  liés) ; rien n'est recalculé ici. Les attributs `data-fraicheur-*` sont ceux d'avant (bancs indicateur-pro, pont,
//  vente-email-fraiche, coque-parametres).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, localeCourante } from './i18n/index.js';
import { LogoSite } from './natif/LogoSite.jsx';
import './etatComptes.css';

// L'adresse où le geste se fait (l'extension relit en passant) ; eBay : Paramètres → Comptes liés (`onEbay`).
export const PAGE_RELIRE = {
  vinted: 'https://www.vinted.fr/',
  leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces',
  vestiaire: 'https://www.vestiairecollective.com/',
};

// « il y a 3 min », « il y a 4 h », « il y a 4 j » — les seuils d'`ageLecture` (src/comptesLies.js), dans la langue.
export function ageCourt(t, maintenant = Date.now()) {
  if (!Number.isFinite(Number(t)) || !t) return '';
  const min = Math.max(0, Math.round((maintenant - Number(t)) / 60000));
  try {
    const f = new Intl.RelativeTimeFormat(localeCourante(), { numeric: 'always', style: 'short' });
    if (min <= 1) return tr('ec.instant');
    if (min < 60) return f.format(-min, 'minute');
    const h = Math.round(min / 60);
    if (h < 48) return f.format(-h, 'hour');
    return f.format(-Math.round(h / 24), 'day');
  } catch (_) { return ''; }
}

const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };

// L'étiquette d'une ligne (rien quand tout va bien : la couleur n'apparaît que s'il y a un geste, §7).
function etiquette(c, masque) {
  if (masque) return { ton: 'gris', texte: tr('ec.tag.masque') };
  if (c.etat === 'banni') return { ton: 'gris', texte: tr('ec.tag.banni') };
  if (c.etat === 'delie') return { ton: 'ambre', texte: tr('ec.tag.delie') };
  if (c.etat === 'jamais') return { ton: 'ambre', texte: tr('ec.tag.jamais') };
  if (c.etat === 'a-relire') return { ton: 'ambre', texte: tr('ec.tag.relire') };
  if (c.ventesRetard) return { ton: 'ambre', texte: tr('ec.tag.ventes') };
  return null;
}

export default function EtatComptes({ lignes = [], masques = new Set(), horsTotaux = () => false, encours = false, passu = [], couleurGeste = '', onEbay = null, ici = true }) {
  const [replie, setReplie] = React.useState(true);
  const estMasque = (c) => c.plateforme === 'vinted' && masques.has(String(c.id));
  const groupes = [
    { cle: 'relire', titre: tr('ec.g.relire'), l: lignes.filter((c) => c.geste) },
    { cle: 'ajour', titre: tr('ec.g.ajour'), l: lignes.filter((c) => !c.geste && c.etat !== 'banni' && !estMasque(c)) },
    { cle: 'autres', titre: tr('ec.g.autres'), l: lignes.filter((c) => !c.geste && (c.etat === 'banni' || estMasque(c))), repli: true },
  ].filter((g) => g.l.length);
  const ouvrir = (c) => {
    if (c.plateforme === 'ebay') { if (onEbay) onEbay(); return; }
    const u = PAGE_RELIRE[c.plateforme]; if (!u) return;
    try { window.open(u, '_blank', 'noopener'); } catch (_) {}
  };
  const ligne = (c) => {
    const m = estMasque(c);
    const tag = etiquette(c, m);
    const age = c.etat === 'ouvert' ? tr('ec.ouvertIci') : c.lu ? ageCourt(c.lu) : '';
    // La ligne d'en dessous : le geste (court, il nomme le site) ou ce qu'il faut savoir, jamais les deux.
    const geste = c.geste ? (c.etat === 'delie' ? tr('ec.geste.delie') : c.ventesRetard && c.etat !== 'a-relire' && c.etat !== 'jamais' ? tr('ec.geste.ventes')
      : c.plateforme === 'ebay' ? tr('ec.geste.ebay') : tr('ec.geste.' + c.plateforme)) : '';
    const savoir = !c.geste ? (m ? tr('ec.sous.masque') : c.etat === 'banni' ? tr('ec.sous.banni') : c.etat === 'ouvert' ? tr('ec.sous.ouvert') : '') : '';
    const hors = horsTotaux(c) ? tr('ec.sous.hors') : '';
    const sous = [geste || savoir, hors].filter(Boolean).join(' · ');
    const touche = c.geste && (c.plateforme === 'ebay' ? !!onEbay : !!PAGE_RELIRE[c.plateforme]) && ici;
    const contenu = (
      <>
        <span className="vrm-ec-logo" aria-hidden="true"><LogoSite site={c.plateforme} taille={20}/></span>
        <span className="vrm-ec-textes">
          <span className="vrm-ec-ligne1">
            <b className="vrm-ec-nom vrm-sensible">{c.nom}</b>
            {tag ? <span className="vrm-ec-tag" data-ton={tag.ton}>{tag.texte}</span> : null}
          </span>
          {sous ? <span className={c.geste ? 'vrm-ec-sous vrm-etat-compte-bloque' : 'vrm-ec-sous'} style={c.geste && couleurGeste ? { color: couleurGeste } : undefined}>{sous}</span> : null}
        </span>
        <span className="vrm-ec-age">{age || '—'}</span>
        {touche ? <span className="vrm-ec-chevron" aria-hidden="true">›</span> : null}
      </>
    );
    const attrs = { className: 'vrm-etat-compte-ligne vrm-ec-rangee', 'data-fraicheur-compte': c.plateforme, 'data-fraicheur-id': c.id, 'data-fraicheur-etat': c.etat,
      'data-fraicheur-geste': c.geste ? '1' : '0', 'data-fraicheur-ventes-retard': c.ventesRetard ? String(c.ventesRetard.lu) : undefined,
      title: `${c.nom} · ${NOM_SITE[c.plateforme] || c.plateforme}${age ? ' · ' + age : ''}` };
    return <li key={c.plateforme + ':' + c.id}>{touche ? <button type="button" {...attrs} onClick={() => ouvrir(c)} aria-label={`${c.nom} · ${NOM_SITE[c.plateforme] || ''} · ${geste}`}>{contenu}</button> : <div {...attrs}>{contenu}</div>}</li>;
  };
  return (
    <div className="vrm-etat-comptes vrm-ec" data-fraicheur-comptes={encours ? 'encours' : passu.length ? 'partiel' : 'lu'}>
      {encours ? <div className="vrm-ec-note">{tr('ec.lecture')}</div> : null}
      {!encours && !lignes.length && !passu.length ? <div className="vrm-ec-note">{tr('ec.aucun')}</div> : null}
      {!encours && groupes.map((g) => {
        const ferme = g.repli && replie;
        return (
          <section key={g.cle} className="vrm-ec-groupe" data-ec-groupe={g.cle}>
            {g.repli
              ? <button type="button" className="vrm-ec-tete vrm-ec-tete-repli" aria-expanded={ferme ? 'false' : 'true'} onClick={() => setReplie(!replie)}>
                  <span>{g.titre}</span><span className="vrm-ec-n">{g.l.length}</span><span className="vrm-ec-fleche" aria-hidden="true">{ferme ? '›' : '⌄'}</span>
                </button>
              : <h3 className="vrm-ec-tete"><span>{g.titre}</span><span className="vrm-ec-n">{g.l.length}</span></h3>}
            <ul className="vrm-ec-liste" hidden={ferme}>{g.l.map(ligne)}</ul>
          </section>
        );
      })}
      {!encours && passu.length > 0 ? <div className="vrm-ec-note" data-fraicheur-passu={passu.join(',')}>{tr('ec.passu', { sites: passu.join(', ') })}</div> : null}
    </div>
  );
}
