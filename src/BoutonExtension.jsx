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
export function BoutonExtension({ action, site = 'vinted', ids = [], variante = 'teinte', libelle = '', large = false, className = '', onOuvert = null, attrs = null }) {
  const c = cibleDe(action, site, ids);
  const url = lienPanneau(c);
  const ouvrir = (e) => { if (e && e.stopPropagation) e.stopPropagation(); ouvrirPanneau(c); if (onOuvert) { try { onOuvert(url); } catch (_) {} } };
  if (className) {
    const ph = extensionIci() ? '' : tr('actionsExt.phrase', { site: NOMS_SITES[c.site] });
    return <button type="button" className={className} onClick={ouvrir} title={ph || undefined} {...attrsDe(action, c, url, attrs)}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}{ph ? <small style={{ display: 'block', opacity: 0.7, fontWeight: 400 }} data-vrm-panneau-phrase="">{ph}</small> : null}</button>;
  }
  return (
    <span className="vrm-ext-geste" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Bouton variante={variante} large={large} onClick={ouvrir} attrs={attrsDe(action, c, url, attrs)}>{libelle || tr(c.cle, { site: NOMS_SITES[c.site] })}</Bouton>
      <PhraseExtension site={c.site}/>
    </span>
  );
}

// (24 nov., livrable) LA LIGNE ENTIÈRE est le geste (une liste d'annonces, une action chacune) : la même phrase
// « Écrire aux favoris dans l'extension » n'est plus répétée sous chaque ligne — elle est le nom (lu) du bouton ;
// la carte la dit UNE fois (`PhraseExtension` à son pied).
export function LigneExtension({ action, site = 'vinted', ids = [], className = '', onOuvert = null, attrs = null, children = null }) {
  const c = cibleDe(action, site, ids);
  const url = lienPanneau(c);
  const ouvrir = (e) => { if (e && e.stopPropagation) e.stopPropagation(); ouvrirPanneau(c); if (onOuvert) { try { onOuvert(url); } catch (_) {} } };
  return <button type="button" className={className} onClick={ouvrir} title={tr(c.cle, { site: NOMS_SITES[c.site] })} {...attrsDe(action, c, url, attrs)}>{children}</button>;
}

export function RangeeExtension({ action, site = 'vinted', ids = [], libelle = '', sousTitre = '', onOuvert = null, attrs = null }) {
  const c = cibleDe(action, site, ids);
  const url = lienPanneau(c);
  const phrase = extensionIci() ? '' : tr('actionsExt.phrase', { site: NOMS_SITES[c.site] });
  return (
    <Rangee titre={libelle || tr(c.cle, { site: NOMS_SITES[c.site] })} sousTitre={[sousTitre, phrase].filter(Boolean).join(' · ')} sousLignes={2} fin="chevron"
      onClick={() => { ouvrirPanneau(c); if (onOuvert) { try { onOuvert(url); } catch (_) {} } }} attrs={attrsDe(action, c, url, attrs)}/>
  );
}

// La feuille qui remplace un ancien atelier d'action : l'état en lecture (enfants), UN bouton plein.
// (22 nov., bugs-totale) Le corps d'une feuille n'a pas de marge à lui (ses groupes portent la leur) : la phrase collait au bord.
export function FeuilleExtension({ action, site = 'vinted', ids = [], titre = '', phrase = '', onFermer, children = null, attrs = null }) {
  return (
    <Feuille ouverte onFermer={onFermer} titre={titre || libelleExtension(action, site)} attrs={{ 'data-vrm-feuille-panneau': action, ...(attrs || {}) }}
      pied={<BoutonExtension action={action} site={site} ids={ids} variante="plein" onOuvert={() => { if (onFermer) onFermer(); }}/>}>
      <p style={{ margin: '0 var(--n-marge, 16px) 12px', color: 'var(--n-encre-2)' }} data-vrm-panneau-explique="">{phrase || tr('actionsExt.explique', { site: NOMS_SITES[site] || NOMS_SITES.vinted })}</p>
      {children}
    </Feuille>
  );
}

export default BoutonExtension;
