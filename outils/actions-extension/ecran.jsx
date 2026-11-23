// ── outils/actions-extension/ecran.jsx — les gestes « … dans l'extension », seuls (hors du paquet de prod) ─────────
// Les VRAIS composants (src/BoutonExtension.jsx, src/PrixPartout.jsx, src/RelanceFavorisCarte.jsx) avec, pour chaque
// ANCIEN geste de l'app, les paramètres que l'app leur passe aujourd'hui (src/App.jsx, src/ecrans/*). Données INVENTÉES.
// Construit par esbuild, jugé par scripts/bancs/actions-extension.cjs.   ?ext=1 : l'extension « répond » ici.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frApp from '../../src/i18n/langues/fr.js';
import { poserIcone, Groupe, Page } from '../../src/natif/index.js';
import { BoutonExtension, RangeeExtension } from '../../src/BoutonExtension.jsx';
import { poserExtensionIci } from '../../src/ouvrirPanneau.js';
import PrixPartout from '../../src/PrixPartout.jsx';
import RelanceFavorisCarte from '../../src/RelanceFavorisCarte.jsx';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frApp);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
poserExtensionIci(() => P.get('ext') === '1');

// Chaque ancien geste : son écran, ce que l'app passe au bouton (les mêmes valeurs que dans le code), le lien attendu.
export const GESTES = [
  ['annonces-republier', 'Annonces → Actions → Republier', 'republier', 'vinted', ['111', '222']],
  ['annonces-modifier', 'Annonces → Actions → Modifier prix ou titre', 'changerPrix', 'vinted', ['111']],
  ['annonces-brouillon', 'Annonces → Actions → Mettre en brouillon', 'versBrouillon', 'vinted', ['111']],
  ['annonces-enligne', 'Brouillons → Mettre en ligne', 'mettreEnLigne', 'vinted', ['d-9']],
  ['annonces-baisser', 'Annonces → Actions → Baisser le prix', 'baisser', 'vinted', ['111', '222']],
  ['fiche-creer', 'À publier → Créer sur Vinted', 'creerVinted', 'vinted', ['124']],
  ['partout-lbc', 'Publier partout / sur… → Leboncoin', 'publier', 'leboncoin', ['111']],
  ['partout-vc', 'Publier partout / sur… → Vestiaire', 'publier', 'vestiaire', ['111']],
  ['lbc-pause', 'Leboncoin → Mettre en pause', 'pause', 'leboncoin', ['2900']],
  ['lbc-supprimer', 'Leboncoin / À retirer → Supprimer', 'supprimer', 'leboncoin', ['2900']],
  ['lbc-baisser', 'Leboncoin → Baisser les prix', 'baisser', 'leboncoin', ['2900', '2901']],
  ['lbc-republier', 'Leboncoin → Republier', 'republier', 'leboncoin', ['2900']],
  ['vc-baisser', 'Vestiaire → Baisser les prix', 'baisser', 'vestiaire', ['p-5']],
  ['vinted-repondre', 'Messages → Vinted → Répondre', 'repondre', 'vinted', ['c-77']],
  ['vinted-offre', 'Messages → Vinted → Offre reçue', 'offres', 'vinted', ['c-77']],
  ['lbc-repondre', 'Messages → Leboncoin → Répondre', 'repondre', 'leboncoin', ['conv-1']],
  ['vc-repondre', 'Messages → Vestiaire → Répondre', 'repondre', 'vestiaire', ['conv-2']],
  ['vc-offre', 'Messages → Vestiaire → Offre', 'offres', 'vestiaire', ['nego-3']],
  ['vc-aimes', 'Vestiaire → Personnes qui aiment', 'favoris', 'vestiaire', ['p-5']],
  ['favoris', 'Messages → Favoris → Écrire aux favoris', 'favoris', 'vinted', []],
  ['offres-auto', 'Offres auto → allumer / régler', 'automatisations', 'vinted', ['offres']],
  ['vacances', 'Réglages → Mode vacances', 'vacances', 'vinted', []],
  ['soldes', 'Argent → Soldes → Remettre les prix', 'remettrePrix', 'vinted', ['111']],
];
window.__GESTES = GESTES;

function Liste() {
  return <Page titre="Gestes dans l’extension">
    <Groupe titre="Chaque ancien geste">{GESTES.map(([id, , action, site, ids]) => <RangeeExtension key={id} action={action} site={site} ids={ids} attrs={{ 'data-banc-geste': id }}/>)}</Groupe>
    <div style={{ padding: 16 }}><BoutonExtension action="republier" ids={['111']} variante="plein" attrs={{ 'data-banc-geste': 'plein' }}/></div>
    <RelanceFavorisCarte res={{ n: 1, cartes: [{ cle: 'v:111', plateforme: 'vinted', id: '111', uid: '42', personnes: 5, depuisJ: 9, numero: '124', titre: 'Nike Air Max 90', offresLues: true }] }} cap={() => 'ok'} version={() => ''}/>
  </Page>;
}
function Prix() {
  const sites = [
    { cle: 'vinted:111', site: 'vinted', id: '111', compte: '42', prix: 59, titre: 'Nike' },
    { cle: 'leboncoin:2900', site: 'leboncoin', id: '2900', prix: 60, titre: 'Nike' },
    { cle: 'vestiaire:p-5', site: 'vestiaire', id: 'p-5', prix: 65, titre: 'Nike' },
    { cle: 'ebay:777', site: 'ebay', id: '777', prix: 62, titre: 'Nike' },
  ];
  return <PrixPartout num="124" sites={sites} attentes={[]} onFermer={() => {}} onAppliquer={async ({ coches }) => { window.__APPLIQUE = [...coches]; return { res: {} }; }}
    regles={[{ uid: '42', nom: 'vendeur_1', actif: true, pct: 10, jours: 14 }]}/>;
}
createRoot(document.getElementById('r')).render(P.get('vue') === 'prix' ? <Prix/> : <Liste/>);
