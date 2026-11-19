// ── outils/app-tableaux/ecran.jsx — les TABLEAUX DE TRAVAIL seuls, dans la coque native (hors du paquet de prod) ──────────
// Les VRAIES vues (src/natif/ecrans/AnnoncesTableau, VentesTableau, AchatsTableau, NotificationsTableau, Automatisations) et
// les VRAIES règles d'articles (src/articles/modele.js : construireArticles, statutTableau, compterArticles), avec des
// données INVENTÉES (aucune donnée réelle). Construit par esbuild, jugé par scripts/bancs/app-tableaux.cjs.
//   ?vue=annonces|ventes|achats|notifs|auto   &base=volume|vide|lbc|vestiaire   &theme=dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp, tr } from '../../src/i18n/index.js';
import frApp from '../../src/i18n/langues/fr.js';
import { poserIcone, Coque, Plaque } from '../../src/natif/index.js';
import AnnoncesTableau from '../../src/natif/ecrans/AnnoncesTableau.jsx';
import VentesTableau from '../../src/natif/ecrans/VentesTableau.jsx';
import AchatsTableau from '../../src/natif/ecrans/AchatsTableau.jsx';
import NotificationsTableau from '../../src/natif/ecrans/NotificationsTableau.jsx';
import Automatisations, { SectionAuto, MessagesAuto, ReglageAuto, ChampNombre } from '../../src/natif/ecrans/Automatisations.jsx';
import { construireArticles, statutTableau, compterArticles, trierArticles, NOM_SITE } from '../../src/articles/modele.js';
import { apercuPaliers, plancherDe, PALIERS_DEFAUT } from '../../src/negociationPaliers.js';
import '../../src/natif/ecrans/annonces.css';
import '../natif-galerie/galerie.css';

ajouterSourceApp(frApp);
const Icon = ({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; };
poserIcone(Icon);
const P = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', P.get('theme') === 'dark' ? 'dark' : 'light');
const VUE = P.get('vue') || 'annonces', BASE = P.get('base') || 'volume';
const photo = (t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" fill="hsl(${t} 32% 80%)"/><path d="M18 74c10-4 20-16 28-26 6 8 14 12 26 14 12 2 20 6 22 12v6H18z" fill="hsl(${t} 25% 45%)"/></svg>`);
const euros = (x) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);
const JOUR = 86400000, M = Date.now();
const MODELES = ['Nike Air Max 1 Athletic Department bleu marine taille 44 — très bon état, boîte d’origine', 'Adidas Samba OG', 'New Balance 550 blanc vert', 'Asics Gel-1130', 'Salomon XT-6 gris', 'Nike Dunk Low Panda'];
const SITES_BASE = { volume: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], vide: [], lbc: ['leboncoin'], vestiaire: ['vestiaire'] }[BASE] || ['vinted'];
const ETATS = ['enligne', 'enligne', 'enligne', 'masquee', 'aconfirmer', 'brouillon', 'vendue', 'retiree', 'pause'];
const n = BASE === 'volume' ? 240 : BASE === 'vide' ? 0 : 40;
const annonces = [];
for (let i = 0; i < n; i++) {
  const site = SITES_BASE[i % SITES_BASE.length]; const e = ETATS[i % ETATS.length];
  annonces.push({ site, id: String(1000 + i), compte: site === 'vinted' ? String(10 + (i % 3)) : site + '-' + (i % 2), pseudo: (site === 'vinted' ? 'vendeur_' : site.slice(0, 3) + '_') + (i % 3),
    titre: MODELES[i % MODELES.length] + (i % 5 === 0 ? '' : ' taille ' + (36 + (i % 10))), photo: i % 4 === 3 ? null : photo(i * 37), prix: i % 17 === 0 ? 1284 : 20 + (i % 70), taille: String(36 + (i % 10)),
    condition: 'Très bon état', depuis: M - (i % 60) * JOUR, favoris: i % 7, vues: (i * 13) % 500, etat: e, numero: i % 6 === 5 ? '' : (i % 23 === 0 ? 'B' + (300 + i) : String(10 + i)), vintedId: '', url: '' });
}
const modele = construireArticles({ annonces, aVinted: SITES_BASE.includes('vinted') ? true : false, faits: {}, fiches: {} });
const comptes = compterArticles(modele.articles, { seuil: 30, maintenant: M });
window.__banc = { compteEnLigne: comptes.tous.enligne, nArticles: modele.articles.length };

function VueAnnoncesBanc() {
  const [site, setSite] = React.useState('tous');
  const lignes = trierArticles(modele.articles).map((a) => ({ a, statut: statutTableau(a, { site }) })).filter((x) => x.statut);
  const sites = [...new Set(modele.articles.flatMap((a) => a.sites))];
  const filtres = sites.length > 1 ? [{ cle: 'site', libelle: tr('egalite.site.titre'), valeur: site, onChange: setSite, options: [{ cle: 'tous', libelle: tr('egalite.site.tous') }, ...sites.map((s) => ({ cle: s, libelle: NOM_SITE[s] }))] }] : [];
  const actions = [{ cle: 'baisser', libelle: tr('egalite.action.baisser'), pour: (a) => a.annonces.some((x) => x.etat === 'enligne'), juger: (s) => ({ ok: s.length > 0, raison: '' }) },
    { cle: 'partout', libelle: tr('egalite.action.partout'), pour: (a) => !!a.numero, juger: (s) => ({ ok: s.length > 0, raison: '' }) }];
  return <AnnoncesTableau articles={lignes} filtres={filtres} majLe={M - 60000} onRafraichir={() => {}} actions={actions} onAction={(c, l) => { document.documentElement.setAttribute('data-banc-action', c + ':' + l.length); }}
    onOuvrir={() => {}} saisir={() => {}} euros={euros} depuisTexte={(ms) => tr('egalite.jours', { n: Math.floor((M - ms) / JOUR) })} nomSite={(s) => NOM_SITE[s] || s} Icon={Icon} sites={sites}
    plein={<button type="button" className="n-bouton" data-n-variante="plein">{tr('egalite.publier')}</button>} onAutomatisations={() => {}}/>;
}
const ETAPES_V = ['À envoyer', 'En transit', 'Vendue', 'Annulée', 'Retour en cours', 'En cours', 'Livrée', 'Remboursée'];
function VueVentesBanc() {
  const lignes = annonces.filter((a) => a.site && n).map((a, i) => ({ cle: a.site + ':' + a.id, site: a.site, id: a.id, titre: a.titre, t: M - i * 3600000 * 5, prix: a.prix, devise: 'EUR', etat: ETAPES_V[i % ETAPES_V.length],
    compte: a.pseudo, num: a.numero, photo: a.photo, tr: i % 3 ? { cle: 'mondialrelay', nom: i % 2 ? 'Mondial Relay' : 'Shop2Shop by Chronopost' } : null }));
  return <VentesTableau lignes={lignes} majLe={M - 120000} onRafraichir={() => {}} prix={(l) => euros(l.prix)} nomSite={(s) => NOM_SITE[s] || s} Icon={Icon}
    imprimable={(l) => l.etat === 'À envoyer'} onImprimer={(l) => document.documentElement.setAttribute('data-banc-action', 'imprimer:' + l.length)} onOuvrir={() => {}}/>;
}
function VueAchatsBanc() {
  const steps = [{ label: 'À retirer', step: 3 }, { label: 'En route', step: 2 }, { label: 'Arrivé', step: 4 }, { label: 'Payé', step: 1 }, { label: 'Annulé', step: 0 }, { label: 'À renvoyer', step: 1, retour: true }];
  const lignes = annonces.slice(0, n ? 120 : 0).map((a, i) => ({ cle: 't' + i, titre: a.titre, photo: a.photo, prix: euros(a.prix), prixNombre: a.prix, t: M - i * 7200000, num: a.numero, compte: a.pseudo, etape: steps[i % steps.length],
    transporteur: i % 2 ? { nom: 'Mondial Relay', logo: null } : null, code: i % steps.length === 0 ? String(416000 + i) : '' }));
  return <AchatsTableau lignes={lignes} majLe={M} onRafraichir={() => {}} onOuvrir={() => {}} onCode={() => {}} Icon={Icon}/>;
}
function VueNotifsBanc() {
  const entrees = Array.from({ length: n ? 40 : 0 }, (_, i) => ({ seq: 100 - i, t: M - i * 3 * 3600000, famille: ['ventes', 'offres', 'messages', 'poster'][i % 4], titre: ['Nouvelle vente', 'Offre reçue', 'Nouveau message', 'Colis à poster'][i % 4] + ' · N°' + (10 + i), texte: 'Paire inventée ' + i, etat: 'envoyee', url: '/' }));
  const lu = { luJusqua: 90, lus: [] };
  return <NotificationsTableau entrees={entrees} lu={lu} types={[{ id: 'ventes', titre: 'Ventes' }, { id: 'offres', titre: 'Offres' }, { id: 'messages', titre: 'Messages' }, { id: 'poster', titre: 'Colis à poster' }]}
    nomType={(f) => f} majLe={M} onRafraichir={() => {}} estLue={(e, l) => e.seq <= l.luJusqua} icone={() => <Icon name="bell2" size={22}/>} onOuvrir={() => {}} onMarquerLues={() => {}} Icon={Icon}/>;
}
function VueAutoBanc() {
  const [choisi, setChoisi] = React.useState('');
  const [msgs, setMsgs] = React.useState([{ texte: 'Bonjour ! Tu as mis cet article en favori : je te propose une offre dessus.', actif: true }, { texte: 'Coucou, il est encore dispo, je te fais un prix ?', actif: false }]);
  const ap = apercuPaliers(100, plancherDe(100, null, 15), PALIERS_DEFAUT);
  const items = [
    { cle: 'favoris', titre: tr('auto.favoris.titre'), sous: tr('auto.favoris.sous'), icone: 'heart', actif: false, plein: { libelle: tr('auto.demarrer'), onClick: () => {} }, reinitialiser: () => {}, modifie: true,
      detail: () => <><SectionAuto titre={tr('auto.messages')} phrase={tr('auto.messages.phrase')}><MessagesAuto messages={msgs} etiquette="Offre −10 %" onModifier={() => {}} onSupprimer={(i) => setMsgs((m) => m.filter((_, j) => j !== i))} onBasculer={(i, v) => setMsgs((m) => m.map((x, j) => (j === i ? { ...x, actif: v } : x)))} onAjouter={(t) => setMsgs((m) => [...m, { texte: t, actif: true }])}/></SectionAuto>
        <SectionAuto titre={tr('auto.delais')}><ReglageAuto libelle={tr('auto.favoris.entre')} phrase={tr('auto.favoris.entrePhrase')}><ChampNombre valeur="6" libelle="min" unite="min" onChange={() => {}}/></ReglageAuto></SectionAuto></> },
    { cle: 'offres', titre: tr('auto.offres.titre'), sous: tr('auto.offres.sous'), icone: 'chat', actif: true, onglets: [{ cle: 'config', libelle: tr('auto.onglet.config') }, { cle: 'nego', libelle: tr('auto.onglet.nego') }],
      plein: { libelle: tr('auto.arreter'), onClick: () => {} }, detail: (o) => (o === 'nego' ? <SectionAuto titre={tr('auto.nego.prix')}><p className="n-au-apercu" data-au-apercu={ap.chaine.join('>') + '|' + ap.plancher}>{tr('auto.nego.apercu', { suite: ap.chaine.join(' → '), plancher: ap.plancher })}</p></SectionAuto> : <SectionAuto titre={tr('auto.ciblage')}><ReglageAuto libelle={tr('auto.offres.accepte')} phrase={tr('auto.offres.acceptePhrase')}/></SectionAuto>) },
    { cle: 'baisse', titre: tr('auto.baisse.titre'), sous: tr('auto.baisse.sous'), icone: 'tag', actif: null, detail: () => <SectionAuto titre={tr('auto.ciblage')}><ReglageAuto libelle={tr('auto.baisse.plancher')} phrase={tr('auto.baisse.plancherPhrase')}/></SectionAuto> },
  ];
  return <Automatisations items={items} choisi={choisi} onChoisir={setChoisi} Icon={Icon} compte="vendeur_1"/>;
}
const ONGLETS = [['journee', 'Aujourd’hui', 'soleilLevant'], ['annonces', 'Annonces', 'tag'], ['ventes', 'Ventes', 'bag'], ['achats', 'Achats', 'cart'], ['compta', 'Argent', 'euro']]
  .map(([cle, libelle, ic]) => ({ cle, libelle, icone: <Icon name={ic} size={24}/>, iconeLaterale: <Icon name={ic} size={20}/> }));
function Ecran() {
  const V = { annonces: VueAnnoncesBanc, ventes: VueVentesBanc, achats: VueAchatsBanc, notifs: VueNotifsBanc, auto: VueAutoBanc }[VUE] || VueAnnoncesBanc;
  const titre = { annonces: 'Annonces', ventes: 'Ventes', achats: 'Achats', notifs: 'Notifications', auto: 'Automatisations' }[VUE];
  return <Coque onglets={ONGLETS} plus={[]} actif={VUE === 'notifs' || VUE === 'auto' ? 'journee' : VUE} onChoisir={() => {}} titre={titre} compte={{ initiales: 'CE', nom: 'Camille Exemple' }}><V/></Coque>;
}
createRoot(document.getElementById('r')).render(<Ecran/>);
