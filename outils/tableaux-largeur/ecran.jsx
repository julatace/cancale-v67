// ── outils/tableaux-largeur/ecran.jsx — les TABLEAUX DE TRAVAIL dans la coque, pour mesurer leur LARGEUR (21 nov.) ─────────────
// Julien (production, Chrome sur Mac, barre latérale ouverte) : « On doit glisser de gauche à droite pour pouvoir tout voir, tu
// peux tout étendre. » Les VRAIES vues (AnnoncesTableau, VentesTableau, AchatsTableau) dans la VRAIE coque (barre latérale),
// données INVENTÉES dont la forme de production : titres longs, Prix mini / Acheté vides partout, une colonne Liaison avec des
// propositions (vignette + « Relier » + « Autre… »). Jugé par scripts/bancs/tableaux-largeur.cjs.
//   ?vue=annonces|ventes|achats   &laterale=0 (barre latérale fermée)   &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import frApp from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque } from '../../src/natif/index.js';
import AnnoncesTableau from '../../src/natif/ecrans/AnnoncesTableau.jsx';
import VentesTableau from '../../src/natif/ecrans/VentesTableau.jsx';
import AchatsTableau from '../../src/natif/ecrans/AchatsTableau.jsx';
import { construireArticles, statutTableau, trierArticles, NOM_SITE } from '../../src/articles/modele.js';
import '../../src/natif/ecrans/annonces.css';

ajouterSourceApp(frApp);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
if (P.get('laterale') === '0') document.documentElement.setAttribute('data-banc-sans-laterale', '');
const VUE = P.get('vue') || 'annonces';
const photo = (t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" fill="hsl(${t} 32% 80%)"/></svg>`);
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
const JOUR = 86400000, M = Date.now();
const MODELES = ['New Balance 9060 x Joe Freshgoods Baby Shower Blue taille 40', 'Nike LD waffle sacai undercover jaune et noir taille 42', 'Autry reelwind low blanc taille 40',
  'Nike p-6000 marron et beige taille 40,5', 'Adidas Handball Spezial Clear Pink Rose Taille 38', 'Nike air Jordan 4 retro blank Canvas taille 42'];
const n = 82;
const annonces = [];
for (let i = 0; i < n; i++) {
  const site = i % 9 === 4 ? 'leboncoin' : 'vinted';
  annonces.push({ site, id: String(5000 + i), compte: site === 'vinted' ? String(10 + (i % 2)) : 'lbc-1', pseudo: site === 'vinted' ? (i % 2 ? 'shop_cancale' : 'vendeur_2') : 'Atelier',
    titre: MODELES[i % MODELES.length], photo: i % 5 === 3 ? null : photo(i * 37), prix: 50 + (i % 45), taille: '40', condition: 'Très bon état',
    depuis: M - (i % 30) * JOUR, favoris: i % 29, vues: i % 3 ? null : (i * 13) % 500, etat: i % 11 === 0 ? 'masquee' : 'enligne', numero: i % 4 === 0 ? '' : String(200 + i), vintedId: '', url: '' });
}
const modele = construireArticles({ annonces, aVinted: true, faits: {}, fiches: {} });
// La colonne Liaison comme en production : quelques propositions (vignette + Relier + Autre…), des « reliée », beaucoup de rien.
const liaison = {
  de: (a) => { const x = a.annonces.find((y) => y.site !== 'vinted'); if (!x) return null; const k = Number(x.id) % 3;
    return k === 0 ? { site: 'Leboncoin', id: x.id, etat: 'aRelier', prop: { paireId: 'p' + x.id, numero: '243', photo: photo(9), titre: 'Nike', niveau: 'sur' } }
      : k === 1 ? { site: 'Leboncoin', id: x.id, etat: 'aRelier', prop: null } : { site: 'Leboncoin', id: x.id, etat: 'relie', numero: '212' }; },
  relier: () => {}, autre: () => {}, propre: () => {}, Photo: null,
};
function VueAnnonces() {
  const lignes = trierArticles(modele.articles).map((a) => ({ a, statut: statutTableau(a, {}) })).filter((x) => x.statut);
  const actions = [{ cle: 'recreer', libelle: tr('egalite.action.republier'), pour: (a) => a.annonces.some((x) => x.etat === 'enligne'), juger: (s) => ({ ok: s.length > 0 }) }];
  const filtres = [{ cle: 'site', libelle: tr('egalite.site.titre'), valeur: 'tous', onChange: () => {}, options: [{ cle: 'tous', libelle: tr('egalite.site.tous') }, { cle: 'vinted', libelle: 'Vinted' }] },
    { cle: 'compte', libelle: tr('tableau.filtre.compte'), valeur: 'tous', onChange: () => {}, options: [{ cle: 'tous', libelle: tr('tableau.tousComptes') }] },
    { cle: 'dort', libelle: tr('tableau.filtre.anciennete'), valeur: 'toutes', onChange: () => {}, options: [{ cle: 'toutes', libelle: tr('tableau.filtre.toutes') }] }];
  return <AnnoncesTableau articles={lignes} filtres={filtres} majLe={M} onRafraichir={() => {}} actions={actions} onAction={() => {}} liaison={liaison} site="tous" Logo={null}
    onOuvrir={() => {}} saisir={() => {}} onNumero={() => {}} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((M - ms) / JOUR) })} nomSite={(s) => NOM_SITE[s] || s} Icon={Icon}
    sites={['vinted', 'leboncoin']} plein={<button type="button" className="n-bouton" data-n-variante="plein">{tr('egalite.publier')}</button>}/>;
}
const ETAPES_V = ['À envoyer', 'En transit', 'Vendue', 'Annulée', 'Retour en cours', 'Livrée'];
function VueVentes() {
  const lignes = annonces.map((a, i) => ({ cle: a.site + ':' + a.id, site: a.site, id: a.id, titre: a.titre, t: M - i * 3600000 * 5, prix: a.prix, devise: 'EUR', etat: ETAPES_V[i % ETAPES_V.length],
    compte: a.pseudo, num: a.numero, photo: a.photo, tr: i % 3 ? { cle: 'mondialrelay', nom: i % 2 ? 'Mondial Relay' : 'Shop2Shop by Chronopost' } : null }));
  return <VentesTableau lignes={lignes} majLe={M} onRafraichir={() => {}} prix={(l) => euros(l.prix)} nomSite={(s) => NOM_SITE[s] || s} Icon={Icon}
    imprimable={(l) => l.etat === 'À envoyer'} onImprimer={() => {}} onOuvrir={() => {}}/>;
}
function VueAchats() {
  const steps = [{ label: 'À retirer', step: 3 }, { label: 'En route', step: 2 }, { label: 'Arrivé', step: 4 }, { label: 'Payé', step: 1 }];
  const lignes = annonces.map((a, i) => ({ cle: 't' + i, titre: a.titre, photo: a.photo, prix: euros(a.prix), prixNombre: a.prix, t: M - i * 7200000, num: a.numero, compte: a.pseudo, etape: steps[i % steps.length],
    transporteur: i % 2 ? { nom: 'Mondial Relay', logo: null } : null, code: i % 4 === 0 ? String(416000 + i) : '' }));
  return <AchatsTableau lignes={lignes} majLe={M} onRafraichir={() => {}} onOuvrir={() => {}} onCode={() => {}} Icon={Icon}/>;
}
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'cart'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Ecran() {
  const V = { annonces: VueAnnonces, ventes: VueVentes, achats: VueAchats }[VUE] || VueAnnonces;
  return <Coque onglets={ONGLETS} plus={[]} actif={VUE} onChoisir={() => {}} titre={{ annonces: 'Annonces', ventes: 'Ventes', achats: 'Achats' }[VUE]} compte={{ initiales: 'CE', nom: 'Camille Exemple' }}><V/></Coque>;
}
createRoot(document.getElementById('r')).render(<Ecran/>);
