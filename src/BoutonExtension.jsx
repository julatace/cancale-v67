// ── src/BoutonExtension.jsx — « … dans l'extension » (décision de Julien du 20 nov.) ─────────────
// UN bouton (ou une rangée) qui ouvre le panneau de l'extension sur le site, avec la sélection et l'action
// (src/ouvrirPanneau.js). C'est la seule forme que prend désormais, dans l'app, un geste sur Vinted,
// Leboncoin ou Vestiaire : l'app ne l'exécute plus (src/actionsExtension.js).
// Sans extension dans ce navigateur (iPhone Safari…), la même URL ouvre le site — Orion porte
// l'extension — et une phrase discrète le dit : « s'ouvre sur Vinted avec l'extension ».
//   <BoutonExtension action="baisser" site="vinted" ids={['123', '456']}/>
//   <RangeeExtension action="republier" ids={ids}/>        (dans un <Groupe>)
//   <FeuilleExtension action="favoris" titre="…" onFermer={…}>l'état, en lecture</FeuilleExtension>
import React from 'react';
import { Bouton, Rangee, Feuille } from './natif/index.js';
import { tr } from './i18n/index.js';
import { lienPanneau, ouvrirPanneau, extensionIci } from './ouvrirPanneau.js';
import { ACTIONS_EXTENSION, NOMS_SITES } from './actionsExtension.js';
// (24 nov., lot agir-si-connecte) LA PORTE : un geste ne s'ouvre que si l'extension de CE navigateur a le compte visé
// dans son onglet (src/agir/peutAgir.js). Sinon le bouton reste VISIBLE, éteint, avec la raison et le geste ; rien ne part.
// `compte` : l'identité du compte visé (uid Vinted, id Leboncoin / Vestiaire). '*' = « le compte de l'onglet » (le panneau
// agit au nom de SON onglet, sa garde refuse une annonce d'un autre compte) — à passer seulement quand l'écran ne le sait pas.
import { usePeutAgir } from './agir/porte.js';
import { texteRaison } from './agir/Agir.jsx';
export const GESTE_DE_ACTION = { changerPrix: 'prix', baisser: 'baisser', remettrePrix: 'prix', republier: 'republier', republierMaintenant: 'republier',
  mettreEnLigne: 'republier', versBrouillon: 'republier', deposer: 'creer', creerVinted: 'creer', publier: 'publier', pause: 'pause', supprimer: 'supprimer',
  repondre: 'repondre', offres: 'offre', favoris: 'favoris', automatisations: 'automatisations', vacances: 'vacances' };
const gesteDe = (action) => GESTE_DE_ACTION[action] || 'automatisations';

const cibleDe = (action, site, ids) => {
  const a = ACTIONS_EXTENSION[action] || ACTIONS_EXTENSION.automatisations;
  return { site: NOMS_SITES[site] ? site : 'vinted', page: a.page, ids: Array.isArray(ids) ? ids : ids == null ? [] : [ids], action: a.action, cle: a.cle };
};
const attrsDe = (action, c, url, attrs) => ({ 'data-vrm-panneau': action, 'data-vrm-panneau-site': c.site, 'data-vrm-panneau-lien': url, ...(attrs || {}) });

export function libelleExtension(action, site = 'vinted') {
  const c = cibleDe(action, site, []);
  return tr(c.cle, { site: NOMS_SITES[c.site] });
}

export function PhraseExtension({ site = 'vinted' }) {
  if (extensionIci()) return null;
  return <span className="n-bouton-raison" data-vrm-panneau-phrase="">{tr('actionsExt.phrase', { site: NOMS_SITES[site] || NOMS_SITES.vinted })}</span>;
}

// `className` : dans un ancien écran, le bouton garde la forme de ses voisins (un <button> de cette classe).
export function BoutonExtension({ action, site = 'vinted', compte = '*', ids = [], variante = 'teinte', libelle = '', large = false, className = '', onOuvert = null, attrs = null }) {
  const c = cibleDe(action, site, ids);
  const url = lienPanneau(c);
  const v = usePeutAgir(c.site, compte, gesteDe(action), 'panneau');
  const porte = { 'data-agir': v.ok ? 'ok' : 'lecture', 'data-agir-site': c.site, 'data-agir-geste': gesteDe(action), 'data-agir-raison': v.ok ? undefined : v.raison };
  const ouvrir = (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (!v.ok) return; ouvrirPanneau({ ...c, compte }); if (onOuvert) { try { onOuvert(url); } catch (_) {} } };
  if (!v.ok) {
    const raison = texteRaison(v);
    if (className) return <button type="button" className={className} aria-disabled="true" onClick={ouvrir} title={raison} {...attrsDe(action, c, url, attrs)} {...porte}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}<small style={{ display: 'block', opacity: 0.75, fontWeight: 400 }} data-agir-phrase="">{raison}</small></button>;
    return <span className="vrm-ext-geste" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Bouton variante={variante} large={large} indisponible raison={raison} attrs={{ ...attrsDe(action, c, url, attrs), ...porte }}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}</Bouton></span>;
  }
  if (className) {
    const ph = extensionIci() ? '' : tr('actionsExt.phrase', { site: NOMS_SITES[c.site] });
    return <button type="button" className={className} onClick={ouvrir} title={ph || undefined} {...attrsDe(action, c, url, attrs)} {...porte}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}{ph ? <small style={{ display: 'block', opacity: 0.7, fontWeight: 400 }} data-vrm-panneau-phrase="">{ph}</small> : null}</button>;
  }
  return (
    <span className="vrm-ext-geste" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Bouton variante={variante} large={large} onClick={ouvrir} attrs={{ ...attrsDe(action, c, url, attrs), ...porte }}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}</Bouton>
      <PhraseExtension site={c.site}/>
    </span>
  );
}

export function RangeeExtension({ action, site = 'vinted', compte = '*', ids = [], libelle = '', sousTitre = '', onOuvert = null, attrs = null }) {
  const c = cibleDe(action, site, ids);
  const url = lienPanneau(c);
  const v = usePeutAgir(c.site, compte, gesteDe(action), 'panneau');
  const porte = { 'data-agir': v.ok ? 'ok' : 'lecture', 'data-agir-site': c.site, 'data-agir-geste': gesteDe(action), 'data-agir-raison': v.ok ? undefined : v.raison };
  const phrase = v.ok ? '' : texteRaison(v);
  return (
    <Rangee titre={libelle || tr(c.cle, { site: NOMS_SITES[c.site] })} sousTitre={[sousTitre, phrase].filter(Boolean).join(' · ')} sousLignes={2} fin={v.ok ? 'chevron' : undefined}
      onClick={v.ok ? () => { ouvrirPanneau({ ...c, compte }); if (onOuvert) { try { onOuvert(url); } catch (_) {} } } : undefined} attrs={{ ...attrsDe(action, c, url, attrs), ...porte, ...(v.ok ? {} : { 'aria-disabled': 'true' }) }}/>
  );
}

// La feuille qui remplace un ancien atelier d'action : l'état en lecture (enfants), UN bouton plein.
// (22 nov., bugs-totale) Le corps d'une feuille n'a pas de marge à lui (ses groupes portent la leur) : la phrase collait au bord.
export function FeuilleExtension({ action, site = 'vinted', compte = '*', ids = [], titre = '', phrase = '', onFermer, children = null, attrs = null }) {
  return (
    <Feuille ouverte onFermer={onFermer} titre={titre || libelleExtension(action, site)} attrs={{ 'data-vrm-feuille-panneau': action, ...(attrs || {}) }}
      pied={<BoutonExtension action={action} site={site} compte={compte} ids={ids} variante="plein" onOuvert={() => { if (onFermer) onFermer(); }}/>}>
      <p style={{ margin: '0 var(--n-marge, 16px) 12px', color: 'var(--n-encre-2)' }} data-vrm-panneau-explique="">{phrase || tr('actionsExt.explique', { site: NOMS_SITES[site] || NOMS_SITES.vinted })}</p>
      {children}
    </Feuille>
  );
}

export default BoutonExtension;
