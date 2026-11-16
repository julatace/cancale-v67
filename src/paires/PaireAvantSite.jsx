// ── LA PAIRE QUI MONTE, SUR LEBONCOIN, eBAY ET VESTIAIRE (16 nov., lot design-restes) ────────────
// Annonces · Vinted fait monter la rangée touchée À SA PLACE (src/paires/PaireAvant.jsx, 14 nov.) ; les
// onglets Leboncoin, eBay et Vestiaire ouvraient encore la fiche par-dessus la liste (« Reste connu »,
// 2026-11-15-version-studio.md). Ce module leur donne la MÊME carte, avec le même hôte (`PaireAvantHote`),
// la même clé (posée par la liste sur la rangée) et la même fiche (« ⋯ » ⇒ `ouvrirFicheDe`, par la ligne
// elle-même : son identité, jamais son titre).
//
// Les chiffres sont ceux que CETTE plateforme a lus, posés par l'écran sur la rangée (`attrsAvantSite`) :
// prix affiché, jours en ligne, favoris (eBay : observateurs), et « acheté » = le prix d'achat SAISI du N°
// de la rangée (`achatDe(num)`, fourni par l'écran : la même lecture `prixAchatDe` que la fiche). Un chiffre
// que la plateforme n'a pas donné s'écrit « — », jamais 0 (§5 « pas su »).
// Rien de métier ici : aucune écriture, aucun geste qui engage. Le seul geste de la carte est « Voir sur
// <site> » (un lien https lu sur l'annonce) ; tout le reste vit dans la fiche, comme avant.
// Banc : scripts/bancs/design-restes.cjs (partie « monte »).
import React from 'react';
import { PaireAvantHote, clicAvant, ouvrirFicheDe, rangeeDe, estTelephone, avantOuvert, ouvrirAvant, fermerAvant } from './PaireAvant.jsx';
import { toucheLeCorps } from '../ficheLigne.js';
import { tr } from '../i18n/index.js';
import { montant } from '../format.js';

const str = (v) => String(v == null ? '' : v).trim();
const nombre = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const lienSur = (u) => { try { const x = new URL(str(u)); return x.protocol === 'https:' && !x.username && !x.password ? x.href : ''; } catch (_) { return ''; } };
export const NOMS_SITES = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
// Le Stock (site `stock`) : sa 4e case dit OÙ la paire est rangée (« Étagère A · r1 c3 »), pas des favoris.

// La clé de la rangée : le site et l'identifiant de l'annonce sur ce site (jamais un titre).
export const cleAvantSite = (site, id) => (str(site) && str(id) ? `${str(site)}:${str(id)}` : '');

// Ce que la rangée porte (attributs `data-sb-av-*`) : affichage seulement, relu par la carte.
//   prix    le prix affiché, déjà écrit (« 62 € ») ou '' ;
//   jours   jours en ligne (nombre) ou null ; favoris / observateurs : nombre ou null ;
//   num     le N° que la liste a trouvé PAR IDENTITÉ ('' sinon) ; lien : l'annonce sur le site (https).
export function attrsAvantSite({ site, id, prix = '', jours = null, favoris = null, observateurs = null, num = '', lien = '', place = null } = {}) {
  const cle = cleAvantSite(site, id);
  if (!cle) return {};
  const a = { 'data-sb-avant-cle': cle, 'data-sb-av-site': str(site) };
  if (str(prix) && str(prix) !== '—') a['data-sb-av-prix'] = str(prix);
  if (nombre(jours) != null) a['data-sb-av-jours'] = String(Math.round(nombre(jours)));
  if (nombre(favoris) != null) a['data-sb-av-favoris'] = String(nombre(favoris));
  if (nombre(observateurs) != null) a['data-sb-av-obs'] = String(nombre(observateurs));
  if (str(num)) a['data-sb-av-num'] = str(num);
  const l = lienSur(lien); if (l) a['data-sb-av-lien'] = l;
  if (place != null) a['data-sb-av-place'] = str(place);   // '' = pas rangée (dit « — · à ranger »)
  return a;
}

// Le toucher d'une rangée de ces listes : un contrôle DE la rangée (« Relier à Vinted », « Gérer »…) garde
// son geste ; le corps de la rangée fait monter la carte (téléphone), la fiche s'ouvre en plan (ordinateur).
export function clicAvantSite(e) {
  const t = e && e.target; if (!t || typeof t.closest !== 'function') return;
  const row = t.closest('[data-sb-avant-cle]'); if (!row) return;
  if (!t.closest('[data-sb-avant-corps]') && !toucheLeCorps(t, row)) return;
  clicAvant(e);
}
// Pour une rangée dont le corps EST un bouton (eBay : `.vrm-eb-ouvrir`) : au téléphone, monter ; sinon `false`.
export function basculerAvant(cle) {
  if (!cle || !estTelephone()) return false;
  if (avantOuvert() === cle) fermerAvant(); else ouvrirAvant(cle);
  return true;
}

const Svg = ({ d, size = 20 }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const FERMER = <path d="M6 6l12 12M18 6 6 18"/>;
const PLUS = <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>;
const SORTIE = <path d="M7 17 17 7M8 7h9v9"/>;

function CarteSite({ cle, fermer, achatDe }) {
  const row = rangeeDe(cle);
  if (!row) return null;
  const g = (k) => str(row.getAttribute(k));
  const site = g('data-sb-av-site');
  const prix = g('data-sb-av-prix');
  const jours = nombre(g('data-sb-av-jours'));
  const obsLu = g('data-sb-av-obs');
  const fav = nombre(obsLu !== '' ? obsLu : g('data-sb-av-favoris'));
  const num = g('data-sb-av-num');
  let achat = null; try { achat = num && typeof achatDe === 'function' ? nombre(achatDe(num)) : null; } catch (_) { achat = null; }
  const lien = lienSur(g('data-sb-av-lien'));
  const aPlace = row.hasAttribute('data-sb-av-place'); const place = g('data-sb-av-place');
  return (<>
    <button type="button" className="sb-rond sb-avant-fermer" data-sb-avant-fermer="" aria-label={tr('studio.paires.fermer')} onClick={fermer}><Svg d={FERMER} size={21}/></button>
    <div className="sb-avant-ch" data-sb-avant-chiffres="">
      <div className="sb-avant-c is-prix" data-sb-avant-chiffre="prix" data-val={prix}><b className="sb-chiffre-affiche">{prix || '—'}</b><span>{tr('studio.paires.prixAffiche')}</span></div>
      <div className="sb-avant-c" data-sb-avant-chiffre="achat" data-val={achat != null ? String(achat) : ''}><b data-vide={achat != null ? undefined : ''}>{achat != null ? montant(achat) : '—'}</b><span>{tr('studio.paires.achete')}</span></div>
      <div className="sb-avant-c" data-sb-avant-chiffre="jours" data-val={jours != null ? String(jours) : ''}><b>{jours != null ? `${jours} ${tr('studio.paires.j')}` : '—'}</b><span>{tr('studio.paires.enLigne')}</span></div>
      {aPlace
        ? <div className="sb-avant-c is-place" data-sb-avant-chiffre="place" data-val={place}><b data-vide={place ? undefined : ''}>{place || '—'}</b><span>{place ? tr('studio.paires.dansStock') : tr('studio.paires.ranger')}</span></div>
        : <div className="sb-avant-c" data-sb-avant-chiffre={obsLu !== '' || site === 'ebay' ? 'observateurs' : 'favoris'} data-val={fav != null ? String(fav) : ''}><b>{fav != null ? fav : '—'}</b><span>{site === 'ebay' ? tr('studio.paires.observateurs') : tr('studio.paires.favoris')}</span></div>}
    </div>
    {/* Sans lien vers le site (le Stock, une annonce sans adresse lue) : « Ouvrir la fiche » prend la rangée entière. */}
    <div className={'sb-avant-gestes sb-avant-gestes-site' + (lien ? '' : ' is-seul')} data-sb-avant-gestes="">
      {lien ? <a className="sb-touche" href={lien} target="_blank" rel="noreferrer" data-sb-avant-voir={site}><Svg d={SORTIE} size={16}/>{tr('studio.paires.voirSur', { site: NOMS_SITES[site] || site })}</a> : null}
      {lien
        ? <button type="button" className="sb-rond" data-sb-avant-plus="" aria-label={tr('studio.paires.plus')} onClick={() => { if (!ouvrirFicheDe(cle)) fermer(); }}><Svg d={PLUS} size={21}/></button>
        : <button type="button" className="sb-touche" data-sb-avant-plus="" onClick={() => { if (!ouvrirFicheDe(cle)) fermer(); }}><Svg d={PLUS} size={16}/>{tr('studio.paires.ouvrirFiche')}</button>}
    </div>
  </>);
}

// L'hôte de ces listes : posé UNE fois à côté de la liste (le même que celui d'Annonces · Vinted).
// `site` : la seule plateforme dont il rend les rangées (deux écrans montés ensemble ne posent jamais deux cartes).
export function PaireAvantSiteHote({ site, achatDe = null }) {
  return <PaireAvantHote rendre={(cle, fermer) => {
    const row = rangeeDe(cle);
    if (!row || row.getAttribute('data-sb-av-site') !== site) return null;
    return <CarteSite cle={cle} fermer={fermer} achatDe={achatDe}/>;
  }}/>;
}
