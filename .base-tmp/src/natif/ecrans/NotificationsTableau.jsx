// ── src/natif/ecrans/NotificationsTableau.jsx — le centre de notifications en TABLEAU DE TRAVAIL (19 nov. soir) ──────────
// Les MÊMES entrées que la feuille de la cloche (`push_journal` rangé par le serveur, `entreesDuJournal`), la même règle du
// « lu » (`estLue`, src/journalNotifs.js), le même toucher (marque lue puis ouvre l'objet). Ce qui change à l'ordinateur :
// type ▾, période « 7 jours », Statut (Non lue · Lue) à compteurs, « Marquer comme lues » en série. Une VUE.
//
// Props : entrees (undefined · null · [e]) ; lu (la ligne du « lu », null = pas su) ; types [{ id, titre }] ; nomType(f) ;
// etatTexte(e) ; quand(t) ; heure(t) ; majLe ; onRafraichir ; onOuvrir(e) ; onMarquerLues([e]) ; estLue(e, lu) ; icone(e) ; haut ; Icon.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { TableauTravail } from '../TableauTravail.jsx';

const JOUR = 86400000;
// (19 nov. soir) Le site d'une notification : celui que SON adresse nomme (`?tab=plat_leboncoin…`, `site=…`) ; aucun ⇒ « non précisé »
// (jamais deviné « Vinted » : une notification sans site n'est rangée sous aucun).
export const siteNotif = (url) => { const u = String(url || '').toLowerCase();
  if (/leboncoin|lbc/.test(u)) return 'leboncoin'; if (/ebay/.test(u)) return 'ebay'; if (/vestiaire|(^|[=&_])vc[_&=]/.test(u)) return 'vestiaire'; if (/vinted/.test(u)) return 'vinted'; return 'aucun'; };
const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const dateHeure = (t) => { try { return new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

export default function NotificationsTableau({ entrees, lu = null, types = [], nomType = (f) => f, etatTexte = () => '', majLe, onRafraichir = null,
  onOuvrir, onMarquerLues = null, estLue = () => true, icone = () => null, haut = null, Icon = null }) {
  const [type, setType] = React.useState('tous');
  const [periode, setPeriode] = React.useState('j7');
  const [site, setSite] = React.useState('tous');
  const depuis = { j7: 7, j30: 30, tout: null }[periode];
  const lignes = React.useMemo(() => {
    if (!Array.isArray(entrees)) return entrees;
    const m = Date.now();
    return entrees.filter((e) => (type === 'tous' || e.famille === type) && (site === 'tous' || siteNotif(e.url) === site) && (depuis == null || m - e.t <= depuis * JOUR)).map((e) => {
      const nl = lu !== null && !estLue(e, lu);
      return { cle: String(e.seq), e, titre: e.titre || tr('tableau.notif.sansTitre'), sous: e.texte || '', icone: icone(e),
        statut: lu === null ? 'passu' : nl ? 'nonlue' : 'lue', type: nomType(e.famille), etat: etatTexte(e), t: e.t,
        texte: [e.titre, e.texte, nomType(e.famille)].join(' '), attrs: { 'data-centre-entree': e.seq, 'data-centre-type': e.famille, 'data-non-lue': nl ? '1' : '0' } };
    });
  }, [entrees, lu, type, site, depuis, estLue, nomType, etatTexte, icone]);
  const sitesVus = Array.isArray(entrees) ? [...new Set(entrees.map((e) => siteNotif(e.url)))].filter((x) => x !== 'aucun') : [];
  const statuts = [{ cle: 'nonlue', libelle: tr('tableau.notif.nonlue'), ton: 'accent' }, { cle: 'lue', libelle: tr('tableau.notif.lue'), ton: 'neutre' },
    ...(lu === null ? [{ cle: 'passu', libelle: tr('tableau.notif.passu'), ton: 'neutre' }] : [])];
  const colonnes = [
    { cle: 'type', libelle: tr('tableau.notif.type'), tri: (l) => l.type },
    { cle: 'etat', libelle: tr('tableau.notif.envoi'), defaut: false, tri: (l) => l.etat || null, rendu: (l) => l.etat || null },
    { cle: 'recue', libelle: tr('tableau.notif.recue'), num: true, tri: (l) => l.t, rendu: (l) => dateHeure(l.t) },
    { cle: 'statut', libelle: tr('tableau.col.statut'), tri: (l) => (l.statut === 'nonlue' ? 0 : 1) },
  ];
  const actions = onMarquerLues && lu !== null ? [{ cle: 'lues', libelle: tr('tableau.notif.marquerLues'), aucune: tr('tableau.notif.toutLu'), pour: (l) => l.statut === 'nonlue' }] : [];
  const filtres = [
    ...(sitesVus.length ? [{ cle: 'site', libelle: tr('egalite.site.titre'), valeur: site, onChange: setSite,
      options: [{ cle: 'tous', libelle: tr('egalite.site.tous') }, ...sitesVus.map((x) => ({ cle: x, libelle: NOMS_SITES[x] })), { cle: 'aucun', libelle: tr('tableau.notif.sansSite') }] }] : []),
    { cle: 'type', libelle: tr('tableau.notif.tousTypes'), valeur: type, onChange: setType, options: [{ cle: 'tous', libelle: tr('tableau.notif.tousTypes') }, ...types.map((t) => ({ cle: t.id, libelle: t.titre }))] },
    { cle: 'periode', libelle: tr('tableau.filtre.periode'), valeur: periode, onChange: setPeriode,
      options: [{ cle: 'j7', libelle: tr('tableau.filtre.jours', { n: 7 }) }, { cle: 'j30', libelle: tr('tableau.filtre.jours', { n: 30 }) }, { cle: 'tout', libelle: tr('tableau.filtre.toutePeriode') }] },
  ];
  return (
    <TableauTravail id="notifications" titre={tr('tableau.notif.titre')} majLe={majLe} onRafraichir={onRafraichir} lignes={lignes} statuts={statuts} filtres={filtres}
      colonnes={colonnes} triDefaut={{ cle: 'recue', sens: 'desc' }} actions={actions} onAction={(cle, ls) => { if (cle === 'lues' && onMarquerLues) onMarquerLues(ls.map((l) => l.e)); }}
      onOuvrir={(l) => onOuvrir(l.e)} grille={false} unite={(n) => tr('tableau.notifications', { n })} placeholder={tr('tableau.notif.chercher')} haut={haut}
      ligneTel={(l) => ({ sousTitre: [l.type, l.sous].filter(Boolean).join(' · '), valeur: null, detailValeur: dateHeure(l.t), ton: l.statut === 'nonlue' ? 'neutre' : 'neutre' })}
      vide={tr('tableau.notif.vide')} pasSu={tr('tableau.notif.pasSu')} Icon={Icon} attrs={{ 'data-centre-tableau': '' }}/>
  );
}
