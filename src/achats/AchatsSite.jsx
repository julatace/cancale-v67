// ── src/achats/AchatsSite.jsx — LES ACHATS D'UN SITE (Leboncoin, Vestiaire) DANS LA DISPOSITION DES ACHATS VINTED ───────
// (20 nov., « même squelette » — Julien : « pour toutes les plateformes tout doit être parfait ») Sous « À régler » et « À
// retirer » de l'onglet Achats : UN groupe « En route » puis « Reçus » (puis « Annulés »), des rangées natives (vignette,
// titre sur 2 lignes, état · date, prix à droite) ; et UN état vide, le même pour chaque site (« pas encore lus » + le geste,
// ou « aucun achat en route » + la lecture). Mêmes lectures, mêmes règles qu'avant (`lbcFinalisee`, `lbcAnnulee`,
// `lbcExpediee`, `vc_achats` lu par l'app) : seule la disposition change. Chargé avec l'écran (budget de démarrage).
import React from 'react';
import { tr } from '../i18n/index.js';
import { localeCourante } from '../i18n/index.js';
import { Groupe, Rangee, Vignette } from '../natif/index.js';
import { nomPlateforme } from '../plateformes.js';
import { photoArticle } from '../photosArticles.js';
import { ordreRecent, quandLeboncoin, quandVestiaire } from '../ordreRecent.js';
import { STYLE_FLOU } from '../flouCompte.js';
import { Icon, ilYaCourt, fmt, lbcEuro, lbcAnnulee, lbcFinalisee, lbcExpediee, dateCourteVc } from '../App.jsx';

function Liste({ site, etat, maj = null, geste = '', enRoute = [], recus = [], annules = [] }) {
  const nom = nomPlateforme(site);
  const rang = (l) => <Rangee key={l.cle} vignette={<Vignette src={l.photo || ''} alt=""/>} titre={l.titre || tr('achats.site.sansTitre')} lignes={2}
    sousTitre={l.sous || ''} valeur={l.prix || null} valeurForte fin={l.href ? 'chevron' : null} href={l.flou ? '' : (l.href || '')}
    attrs={l.flou ? { ...(l.attrs || {}), 'data-flou': '1', inert: '', 'aria-hidden': 'true', style: STYLE_FLOU } : (l.attrs || null)}/>;
  // (21 nov., captures de Julien : trois grands logos « Leboncoin », « eBay », « Vestiaire » avec rien dessous, et « Achats Vestiaire :
  //    pas encore lus ») Un site sans achat, ou pas encore lu, ne prend AUCUNE place dans Achats : son état se dit dans Paramètres
  //    → Extension (la page « ce navigateur ») ; seule une lecture RATÉE (« pas su ») garde sa ligne, discrète.
  if (etat !== 'passu' && (etat !== 'lu' || !(enRoute.length + recus.length + annules.length))) return null;
  if (etat !== 'lu' || !(enRoute.length + recus.length + annules.length)) {
    const titre = tr('achats.site.' + (etat === 'encours' ? 'lecture' : etat === 'passu' ? 'passu' : etat === 'jamais' ? 'jamais' : 'aucun'), { site: nom });
    const sous = etat === 'lu' && maj ? tr('achats.site.lu', { quand: ilYaCourt(maj) }) : etat === 'jamais' ? geste : '';
    return <Groupe titre={tr('achats.site.enRoute')} attrs={{ 'data-achats-site': site, 'data-achats-site-vide': etat }}>
      <Rangee icone={<Icon name="box" size={22}/>} titre={titre} lignes={2} sousTitre={sous} sousLignes={2}/>
    </Groupe>;
  }
  // Le site dit dans le titre du groupe (« Leboncoin · En route · 2 ») : plus de grand intertitre à logo au-dessus.
  const g = (cle, l) => (l.length ? <Groupe titre={`${nom} · ${tr('achats.site.' + cle)} · ${l.length}`} attrs={{ 'data-achats-groupe': cle }}>{l.map(rang)}</Groupe> : null);
  return <div data-achats-site={site}>{g('enRoute', enRoute)}{g('recus', recus)}{g('annules', annules)}</div>;
}

const date = (d) => (d && !isNaN(d) ? d.toLocaleDateString(localeCourante(), { day: 'numeric', month: 'short' }) : '');

// `floute(o)` : la ligne d'un AUTRE compte que celui ouvert (lbcFloute / vcFloute de l'écran) — estompée, inerte.
export default function AchatsSite({ site, lbcVentes = null, d = undefined, floute = () => false }) {
  if (site === 'leboncoin') {
    const achats = (lbcVentes && lbcVentes.achats) || [];
    const etape = (o) => (lbcAnnulee(o) ? '' : lbcFinalisee(o) ? tr('achats.site.recus') : lbcExpediee(o) ? tr('achats.site.enRoute') : String(o.stepLabel || '').trim());
    const ligne = (o) => ({ cle: String(o.txId), titre: o.title, photo: photoArticle(o), prix: lbcEuro(o.price),
      sous: [etape(o), date(o.dateVente ? new Date(o.dateVente) : null)].filter(Boolean).join(' · '),
      href: o.label && /^https?:\/\//.test(String(o.label.trackingUrl || '')) ? o.label.trackingUrl : '', attrs: { 'data-lbc-achat': String(o.txId || '') }, flou: !!floute(o) });
    const tri = (arr) => ordreRecent(arr, (o) => quandLeboncoin(o)).map(ligne);
    const actives = achats.filter((o) => !lbcAnnulee(o));
    return <Liste site="leboncoin" etat={achats.length || (lbcVentes && lbcVentes.maj) ? 'lu' : 'jamais'} maj={(lbcVentes && lbcVentes.maj) || null} geste={tr('achats.site.gesteLbc')}
      enRoute={tri(actives.filter((o) => !lbcFinalisee(o)))} recus={tri(actives.filter(lbcFinalisee))} annules={tri(achats.filter(lbcAnnulee))}/>;
  }
  // Vestiaire : `d` = undefined en cours · null pas su · { achats, lecture }
  const etat = d === undefined ? 'encours' : d === null ? 'passu' : !d.achats ? 'jamais' : 'lu';
  const liste = d && d.achats ? ordreRecent(Object.entries(d.achats).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => ({ id, ...v })), quandVestiaire) : [];
  const recu = (v) => /livr|reçu|recu|delivered|completed|termin/i.test(String(v.etat || ''));
  const ligne = (v) => ({ cle: v.id, titre: v.nom || '', photo: v.photo || '', prix: v.montant && isFinite(Number(v.montant.valeur)) ? fmt(v.montant.valeur) : null,
    sous: [v.etat || '', dateCourteVc(v.date) || '', v.suivi ? (v.transporteur || '') : ''].filter(Boolean).join(' · '), attrs: { 'data-vc-achat': v.id }, flou: !!floute(v) });
  return <Liste site="vestiaire" etat={etat} maj={d && d.lecture ? d.lecture.at : null} geste={tr('achats.site.gesteVc')}
    enRoute={liste.filter((v) => !recu(v)).map(ligne)} recus={liste.filter(recu).map(ligne)}/>;
}
