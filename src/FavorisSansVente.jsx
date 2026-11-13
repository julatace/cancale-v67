// ═══════════════════════════════════════════════════════════════════════════
// TRÈS AIMÉES, PAS VENDUES (13 nov., lot 31) — présentation.
// La règle (quelles annonces, à qui écrire, le prix proposé, le plancher achat
// + 10 %) est dans src/favorisSansVente.js ; ici on DESSINE, par compte : photo,
// N°, prix, favoris, jours en ligne, la remise x (la sienne) et le prix qui en
// sort, et le geste « Proposer une offre aux N favoris » — qui ne fait que
// PRÉ-REMPLIR le flux des messages aux favoris (rien ne part sans « Envoyer »).
// Le compte de l'onglet vinted.fr a les gestes ; les autres sont à lire.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { offreSansVente, JOURS_MIN } from './favorisSansVente.js';

const eur = (x) => (x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €');

function Photo({ src, PhotoVinted }) {
  const vide = <span className="vrm-fc-photo-vide" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg></span>;
  return <span className="vrm-fc-photo" style={{ '--t': '56px' }}>{src && PhotoVinted ? <PhotoVinted src={src} alt="" loading="lazy" repli={vide} /> : vide}</span>;
}

// Une annonce. `contact` = { ids, deja } (null : compte à lire seulement).
function Annonce({ a, contact, proposer, verrou, PhotoVinted, actif }) {
  useLangue();
  const [remise, setRemise] = React.useState('');
  const o = offreSansVente({ prix: a.prix, achat: a.achat, remise });
  const n = contact ? contact.ids.length : 0;
  let ligne, ambre = false;
  if (o.etat === 'ok') ligne = o.limitee ? tr('favoris.sansVente.offreLimitee', { apres: eur(o.apres), pct: o.pct, plancher: eur(o.plancher) }) : tr('favoris.sansVente.offre', { apres: eur(o.apres), pct: o.pct });
  else if (o.etat === 'saisir') { ligne = tr('favoris.sansVente.achatInconnu'); ambre = true; }
  else if (o.etat === 'plancher') { ligne = tr('favoris.sansVente.auPlancher', { plancher: eur(o.plancher) }); ambre = true; }
  else { ligne = tr('favoris.sansVente.remiseInvalide'); ambre = true; }
  const peut = contact && n > 0 && o.etat === 'ok' && !verrou;
  const attrs = { 'data-sv-annonce': a.itemId, 'data-sv-favoris': a.favoris, 'data-sv-jours': a.jours, 'data-sv-prix': a.prix, 'data-sv-n': contact ? n : '', 'data-sv-offre': o.etat === 'ok' ? o.apres : '', 'data-sv-pct': o.etat === 'ok' ? o.pct : '', 'data-sv-etat': o.etat, ...(actif ? { 'data-sv-actif': '' } : {}) };
  return <li className={'vrm-sv-ligne' + (actif ? ' is-choisie' : '')} {...attrs}>
    <div className="vrm-sv-haut">
      <Photo src={a.photo} PhotoVinted={PhotoVinted} />
      <span className="vrm-fc-annonce-texte">
        <span className="vrm-fc-titre">{a.numero ? <b className="vrm-sv-num" data-sv-num={a.numero}>N°{a.numero}</b> : null}{a.titre || tr('favoris.qui.sansTitre')}</span>
        <span className="vrm-fc-meta"><b>{eur(a.prix)}</b><span>{tr('favoris.sansVente.favoris', { n: a.favoris })}</span><span>{tr('favoris.sansVente.jours', { n: a.jours })}</span></span>
      </span>
    </div>
    <div className="vrm-sv-offre">
      <label className="vrm-fc-mini">{tr('favoris.sansVente.remise')}<input type="text" inputMode="numeric" maxLength={2} value={remise} placeholder={a.achat != null ? '10' : ''} disabled={verrou} onChange={(e) => setRemise(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label={tr('favoris.sansVente.remiseAria', { titre: a.titre || tr('favoris.qui.sansTitre') })} data-sv-remise="" />%</label>
      <span className={'vrm-sv-prix' + (ambre ? ' is-geste' : '')} data-sv-ligne="">{ligne}</span>
    </div>
    {contact ? <div className="vrm-sv-geste">
      <button type="button" className="vrm-fc-bouton" disabled={!peut} data-sv-proposer={a.itemId} onClick={() => peut && proposer(a, o, contact.ids)}>{n > 0 ? tr('favoris.sansVente.proposer', { n }) : tr('favoris.sansVente.personne')}</button>
      <small className="vrm-fc-aide" data-sv-deja={contact.deja}>{n === 0 ? (contact.deja > 0 ? tr('favoris.sansVente.tousContactes', { n: contact.deja }) : tr('favoris.sansVente.aucunConnu')) : contact.deja > 0 ? tr('favoris.sansVente.deja', { n: contact.deja }) : tr('favoris.sansVente.connus', { n, total: a.favoris })}</small>
    </div> : null}
  </li>;
}

// Les raisons des annonces pas listées, dites (pas su ≠ pas assez aimée).
function Ecartees({ e }) {
  if (!e) return null;
  const morceaux = [];
  if (e.favoris) morceaux.push(tr('favoris.sansVente.ecFavoris', { n: e.favoris }));
  if (e.date) morceaux.push(tr('favoris.sansVente.ecDate', { n: e.date }));
  if (e.prix) morceaux.push(tr('favoris.sansVente.ecPrix', { n: e.prix }));
  if (e.lecture) morceaux.push(tr('favoris.sansVente.ecLecture', { n: e.lecture }));
  if (e.reservee) morceaux.push(tr('favoris.sansVente.ecReservee', { n: e.reservee }));
  if (!morceaux.length) return null;
  return <p className="vrm-fc-aide" data-sv-ecartees={JSON.stringify(e)}>{morceaux.join(' · ')}</p>;
}

function ListeCompte({ c, proposer, verrou, PhotoVinted, actif, seuil }) {
  const res = c.res;
  if (res.lecture !== 'ok') return <p className="vrm-fc-note" data-sv-passu="">{tr('favoris.sansVente.pasLu')}</p>;
  return <>
    {res.annonces.length
      ? <ul className="vrm-sv-liste" data-sv-liste={c.uid}>{res.annonces.map((a) => <Annonce key={a.itemId} a={a} contact={c.selectionnable ? c.contactDe(a.itemId) : null} proposer={proposer} verrou={verrou} PhotoVinted={PhotoVinted} actif={actif === a.itemId} />)}</ul>
      : <p className="vrm-fc-note" data-sv-vide={c.uid}>{tr('favoris.sansVente.vide', { n: seuil, j: JOURS_MIN })}</p>}
    <Ecartees e={res.ecartees} />
  </>;
}

export default function FavorisSansVente({ comptes = [], seuil, setSeuil, proposer, verrou, PhotoVinted, actif = '' }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState(false);
  const tete = comptes[0];
  if (!tete) return null;
  const n = tete.res.lecture === 'ok' ? tete.res.annonces.length : null;
  return <section className="vrm-fc-etape vrm-fu-blanc vrm-sv" data-fc-etape="sans-vente" aria-label={tr('favoris.sansVente.titre')}>
    <div className="vrm-fc-etape-tete">
      <h3>{tr('favoris.sansVente.titre')}</h3>
      <span className="vrm-fc-resume" data-sv-total={n == null ? '' : n}>{n == null ? '—' : tr('favoris.sansVente.nombre', { n })}</span>
    </div>
    <p className="vrm-fc-aide">{tr('favoris.sansVente.aide', { j: JOURS_MIN })}</p>
    <label className="vrm-fc-mini vrm-sv-seuil">{tr('favoris.sansVente.seuil')}<input type="text" inputMode="numeric" maxLength={3} value={seuil} onChange={(e) => setSeuil(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label={tr('favoris.sansVente.seuilAria')} data-sv-seuil="" />{tr('favoris.sansVente.seuilUnite')}</label>
    <div className="vrm-fpc-compte" data-sv-compte={tete.uid}>
      <div className="vrm-fpc-tete" data-sv-onglet={tete.selectionnable ? '1' : '0'}><div className="vrm-fpc-tete-texte"><strong>{tete.nom || tr('favoris.liste.compte')}</strong><small>{tete.selectionnable ? tr('favoris.liste.compteOnglet') : tr('favoris.liste.autreCompte')}</small></div></div>
      <ListeCompte c={tete} proposer={proposer} verrou={verrou} PhotoVinted={PhotoVinted} actif={actif} seuil={seuil} />
    </div>
    {comptes.length > 1 && <details className="vrm-fpc-autres" data-sv-autres="" onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary className="vrm-fpc-resume vrm-fc-sous-titre">{tr('favoris.liste.autres')}</summary>
      {ouvert && comptes.slice(1).map((c) => <div key={c.uid} className="vrm-fpc-compte" data-sv-compte={c.uid}>
        <div className="vrm-fpc-tete" data-sv-onglet="0"><div className="vrm-fpc-tete-texte"><strong>{c.nom || tr('favoris.liste.compte')}</strong><small>{tr('favoris.liste.autreCompte')}</small></div></div>
        <ListeCompte c={c} proposer={proposer} verrou={verrou} PhotoVinted={PhotoVinted} seuil={seuil} />
      </div>)}
    </details>}
  </section>;
}
