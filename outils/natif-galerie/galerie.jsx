// ── outils/natif-galerie/galerie.jsx — LA GALERIE de « VRM natif » (hors du paquet de prod) ─────────
// Chaque composant de src/natif/ dans ses états, avec des données INVENTÉES. Construite par esbuild et
// servie par le banc : `node scripts/bancs/natif-galerie.cjs` (qui la juge et la photographie).
//   ?vue=galerie (défaut) · ?vue=coque · ?vue=coque3 (trois volets) · ?vue=feuille · ?vue=poussee
//   &theme=dark · &vide=1 (base vide)
// `vrm-icones-app` : les VRAIS tracés d'icônes de l'app (ICON_PATHS de src/App.jsx), extraits par le banc.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { ICON_PATHS } from 'vrm-icones-app';
import { ajouterSourceApp } from '../../src/i18n/index.js';
import frNatif from '../../src/i18n/langues/fr/natif.js';
import {
  poserIcone, Bouton, BoutonIcone, Pastille, Plaque, Affiche, Vide, Attente, Faits, Fait, Segmente, Groupe, Rangee, Vignette,
  Interrupteur, Feuille, Toast, Page, PagePoussee, ChampRecherche, BarreOnglets, BarreLaterale, Coque,
} from '../../src/natif/index.js';
import './galerie.css';

ajouterSourceApp(frNatif);

// Le même dessin que `Icon` de l'app (src/App.jsx) : mêmes tracés, même trait.
const Icon = ({ name, size = 24 }) => {
  const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
};
poserIcone(Icon);

const P = new URLSearchParams(location.search);
if (P.get('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.setAttribute('data-theme', 'light');
const VUE = P.get('vue') || 'galerie';
const BASE_VIDE = P.get('vide') === '1';

// Des « photos » inventées : un aplat et une forme, en SVG (aucune vraie photo dans le dépôt).
const photo = (teinte, forme = 0) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" fill="hsl(${teinte} 32% 86%)"/><path d="M18 74c10-4 20-16 28-26 6 8 14 12 26 14 12 2 22 6 22 14v4H18z" fill="hsl(${teinte} 38% ${forme ? 34 : 46}%)"/><rect x="18" y="80" width="76" height="5" rx="2.5" fill="hsl(${teinte} 20% 96%)"/></svg>`);

const PAIRES = [
  { id: 'a', titre: 'Nike Air Max 90 Triple White', n: 124, taille: '42', etat: 'très bon état', prix: '45 €', ph: photo(210) },
  { id: 'b', titre: 'Adidas Samba OG Cloud White Core Black Gum — édition 2024, boîte d’origine', n: 131, taille: '41 ⅓', etat: 'neuf avec étiquette', prix: '1 284 €', ph: photo(28, 1) },
  { id: 'c', titre: 'New Balance 550 White Green', n: 'B230', taille: '43', etat: 'bon état', prix: '60 €', ph: '' },
  { id: 'd', titre: 'Asics Gel-Kayano 14 Cream Black', n: 1234, taille: '44,5', etat: 'satisfaisant', prix: '85 €', ph: photo(120) },
  { id: 'e', titre: 'Salomon XT-6 Vanilla Ice', n: 88, taille: '42 ⅔', etat: 'très bon état', prix: '110 €', ph: photo(330, 1) },
];

const ONGLETS = [
  { cle: 'aujourdhui', libelle: 'Aujourd’hui', icone: <Icon name="home" size={24}/>, iconeLaterale: <Icon name="home" size={20}/> },
  { cle: 'annonces', libelle: 'Annonces', icone: <Icon name="tag" size={24}/>, iconeLaterale: <Icon name="tag" size={20}/> },
  { cle: 'ventes', libelle: 'Ventes', icone: <Icon name="truck" size={24}/>, iconeLaterale: <Icon name="truck" size={20}/>, pastille: 3, libellePastille: '3 colis à envoyer' },
  { cle: 'achats', libelle: 'Achats', icone: <Icon name="bag" size={24}/>, iconeLaterale: <Icon name="bag" size={20}/> },
  { cle: 'argent', libelle: 'Argent', icone: <Icon name="euro" size={24}/>, iconeLaterale: <Icon name="euro" size={20}/> },
];
const PLUS = [
  { entrees: [
    { cle: 'stock', libelle: 'Stock', icone: <Icon name="box" size={22}/>, iconeLaterale: <Icon name="box" size={20}/> },
    { cle: 'messages', libelle: 'Messages', icone: <Icon name="chat" size={22}/>, iconeLaterale: <Icon name="chat" size={20}/>, pastille: 12, libellePastille: '12 messages non lus' },
    { cle: 'emails', libelle: 'E-mails', icone: <Icon name="mail" size={22}/>, iconeLaterale: <Icon name="mail" size={20}/> },
  ] },
  { entrees: [
    { cle: 'sante', libelle: 'Tout va bien ?', icone: <Icon name="pulse" size={22}/>, iconeLaterale: <Icon name="pulse" size={20}/>, valeur: '2 points' },
    { cle: 'reglages', libelle: 'Paramètres', icone: <Icon name="gear" size={22}/>, iconeLaterale: <Icon name="gear" size={20}/> },
    { cle: 'communaute', libelle: 'Communauté', icone: <Icon name="users" size={22}/>, iconeLaterale: <Icon name="users" size={20}/> },
  ] },
];

// Une case de la galerie : `data-g="composant:état"` (le banc s'y accroche), une légende.
function Case({ g, legende, nu = false, children }) {
  return (
    <div className="g-case" data-g={g}>
      <p className="g-legende">{legende || g.split(':')[1]}</p>
      <div className={nu ? 'g-nu' : 'g-fond'}>{children}</div>
    </div>
  );
}
function Section({ titre, children }) {
  return <section className="g-section" data-g-section={titre}><h2 className="g-titre">{titre}</h2>{children}</section>;
}

const rangeeDe = (p, extra = {}) => (
  <Rangee
    key={p.id}
    vignette={<Vignette src={p.ph} alt=""/>}
    titre={p.titre}
    lignes={2}
    plaque={<Plaque numero={p.n}/>}
    sousTitre={`${p.taille} · ${p.etat}`}
    valeur={p.prix}
    valeurForte
    fin="chevron"
    onClick={() => {}}
    {...extra}
  />
);

function Galerie() {
  const [seg, setSeg] = React.useState('envoyer');
  const [seg2, setSeg2] = React.useState('b');
  const [inter, setInter] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [feuille, setFeuille] = React.useState(false);
  const [journal, setJournal] = React.useState([]);
  const [toast, setToast] = React.useState(null);
  const [repli, setRepli] = React.useState(false);
  const noter = (x) => setJournal((j) => [...j, x]);
  return (
    <div className="g-galerie" data-g-journal={journal.join(',')}>
      <h1 className="g-grand">VRM natif — la galerie</h1>

      <Section titre="Bouton">
        <Case g="bouton:plein-repos" legende="plein · repos"><Bouton variante="plein" icone={<Icon name="printer" size={20}/>} onClick={() => noter('plein')}>Imprimer 3 bordereaux</Bouton></Case>
        <Case g="bouton:plein-enfonce" legende="plein · enfoncé"><Bouton variante="plein" attrs={{ 'data-n-force': 'appui' }}>Imprimer 3 bordereaux</Bouton></Case>
        <Case g="bouton:plein-focus" legende="plein · focus"><Bouton variante="plein" attrs={{ 'data-n-force': 'focus' }}>Imprimer 3 bordereaux</Bouton></Case>
        <Case g="bouton:plein-chargement" legende="plein · chargement"><Bouton variante="plein" chargement>Impression…</Bouton></Case>
        <Case g="bouton:plein-indisponible" legende="plein · indisponible, avec sa raison"><Bouton variante="plein" indisponible raison="Aucun bordereau prêt : ils arrivent par e-mail.">Imprimer les bordereaux</Bouton></Case>
        <Case g="bouton:plein-long" legende="plein · libellé long"><Bouton variante="plein">Imprimer les 1 234 bordereaux prêts de tous les comptes sélectionnés</Bouton></Case>
        <Case g="bouton:teinte" legende="teinté · repos / enfoncé / indisponible">
          <div className="g-ligne">
            <Bouton onClick={() => noter('teinte')}>Voir les codes</Bouton>
            <Bouton attrs={{ 'data-n-force': 'appui' }}>Voir les codes</Bouton>
            <Bouton indisponible raison="Aucun code reçu.">Voir les codes</Bouton>
          </div>
        </Case>
        <Case g="bouton:texte" legende="texte · repos / enfoncé / chargement">
          <div className="g-ligne">
            <Bouton variante="texte">J’ai retiré</Bouton>
            <Bouton variante="texte" attrs={{ 'data-n-force': 'appui' }}>J’ai retiré</Bouton>
            <Bouton variante="texte" chargement>J’ai retiré</Bouton>
          </div>
        </Case>
        <Case g="bouton:destructif" legende="destructif · il demande avant (2 touchers)">
          <div className="g-ligne">
            <Bouton variante="destructif" confirmation="Supprimer pour de bon" onClick={() => noter('supprime')} attrs={{ 'data-g-destructif': '' }}>Supprimer l’annonce</Bouton>
          </div>
        </Case>
        <Case g="bouton:icone" legende="icône seule · 44 × 44, nommée">
          <div className="g-ligne">
            <BoutonIcone libelle="Scanner un colis" icone={<Icon name="scan" size={22}/>}/>
            <BoutonIcone libelle="Messages" icone={<Icon name="chat" size={24}/>} pastille={<Pastille ton="ambre-plein" className="n-coin-pastille">{3}</Pastille>}/>
            <BoutonIcone libelle="Filtrer" icone={<Icon name="filter" size={22}/>} actif/>
            <BoutonIcone libelle="Aide" icone={<Icon name="help" size={22}/>} attrs={{ 'data-n-force': 'focus' }}/>
          </div>
        </Case>
      </Section>

      <Section titre="Segmente">
        <Case g="segmente:trois" legende="trois choix, un compte" nu>
          <Segmente libelle="Filtrer les ventes" valeur={seg} onChange={setSeg} options={[{ cle: 'envoyer', libelle: 'À envoyer', n: 3 }, { cle: 'route', libelle: 'En route' }, { cle: 'finies', libelle: 'Finies' }]}/>
        </Case>
        <Case g="segmente:cinq" legende="cinq choix, libellés longs" nu>
          <Segmente libelle="Plateforme" valeur={seg2} onChange={setSeg2} options={[{ cle: 'a', libelle: 'Tout' }, { cle: 'b', libelle: 'Vinted' }, { cle: 'c', libelle: 'Leboncoin' }, { cle: 'd', libelle: 'eBay' }, { cle: 'e', libelle: 'Vestiaire Collective' }]}/>
        </Case>
      </Section>

      <Section titre="Groupe et Rangee">
        <Case g="rangee:72" legende="rangées 72 · vignette 56, plaque, prix (titre long, sans photo, 4 chiffres)" nu>
          <Groupe titre="À envoyer" pied="3 bordereaux prêts sur 4" action={<Bouton variante="texte">Tout voir</Bouton>}>
            {PAIRES.slice(0, 4).map((p) => rangeeDe(p))}
          </Groupe>
        </Case>
        <Case g="rangee:etats" legende="repos · enfoncée · focus · sélectionnée · indisponible" nu>
          <Groupe>
            {rangeeDe(PAIRES[0])}
            {rangeeDe(PAIRES[4], { attrs: { 'data-n-force': 'appui' } })}
            {rangeeDe(PAIRES[3], { attrs: { 'data-n-force': 'focus' } })}
            {rangeeDe(PAIRES[0], { selectionnee: true })}
            {rangeeDe(PAIRES[2], { indisponible: true, raison: 'Vendue sur un autre site : à retirer d’abord.' })}
          </Groupe>
        </Case>
        <Case g="rangee:balayage" legende="balayage → actions (← au clavier, clic droit à la souris)" nu>
          <Groupe titre="Balayer vers la gauche">
            {rangeeDe(PAIRES[0], { attrs: { 'data-g-balayage': 'a' }, actions: [
              { cle: 'baisser', libelle: 'Baisser', ton: 'neutre', icone: <Icon name="tag" size={20}/>, onClick: () => noter('baisser') },
              { cle: 'envoye', libelle: 'Envoyé', icone: <Icon name="check" size={20}/>, onClick: () => noter('envoye'), franc: true },
            ] })}
            {rangeeDe(PAIRES[4], { attrs: { 'data-g-balayage': 'b' }, actions: [
              { cle: 'retire', libelle: 'Retiré', ton: 'ambre', onClick: () => noter('retire') },
            ] })}
          </Groupe>
        </Case>
        <Case g="rangee:56" legende="rangées 56 · vignette 44" nu>
          <Groupe titre="Dernières ventes">
            <Rangee vignette={<Vignette src={PAIRES[0].ph} taille={44} alt=""/>} titre={PAIRES[0].titre} sousTitre="hier · Vinted · jujuf38" valeur="45 €" detailValeur="reçu" onClick={() => {}}/>
            <Rangee vignette={<Vignette src="" taille={44} alt=""/>} titre={PAIRES[1].titre} sousTitre="lundi · Leboncoin" valeur="1 284 €" detailValeur="à dater" onClick={() => {}}/>
            <Rangee vignette={<Vignette src={PAIRES[3].ph} taille={44} alt=""/>} titre={PAIRES[3].titre} ton="ambre" sousTitre="à poster avant demain 18 h" valeur="85 €" onClick={() => {}}/>
          </Groupe>
        </Case>
        <Case g="rangee:44" legende="rangées 44 · l’app Réglages (icône, valeur, chevron, coche, interrupteur, pastille)" nu>
          <Groupe titre="Réglages" pied="La langue est la même sur tous tes appareils.">
            <Rangee icone={<Icon name="langue" size={22}/>} titre="Langue" valeur="Français" fin="chevron" onClick={() => {}}/>
            <Rangee icone={<Icon name="moon" size={22}/>} titre="Mode sombre" interrupteur={{ actif: inter, onChange: setInter, attrs: { 'data-g-interrupteur': '' } }}/>
            <Rangee icone={<Icon name="bell2" size={22}/>} titre="Notifications" pastille={<Pastille ton="ambre">À régler</Pastille>} fin="chevron" onClick={() => {}}/>
            <Rangee icone={<Icon name="printer" size={22}/>} titre="Imprimante" valeur="Brother QL-1110" fin="chevron" onClick={() => {}}/>
            <Rangee icone={<Icon name="doc" size={22}/>} titre="Format des étiquettes thermiques de la douchette" valeur="100 × 150" fin="chevron" onClick={() => {}}/>
            <Rangee titre="Vinted" fin="coche" onClick={() => {}}/>
            <Rangee titre="Leboncoin" onClick={() => {}}/>
            <Rangee titre="Version" valeur="5.393.0"/>
          </Groupe>
        </Case>
        <Case g="groupe:section" legende="titre de section 22/28 · groupe replié" nu>
          <Groupe grand titre="Ce mois">
            <Rangee titre="Vendu" valeur="2 480 €" valeurForte/>
            <Rangee titre="Reçu" valeur="1 912 €" valeurForte detailValeur="sur 31 ventes"/>
            <Rangee titre="Bénéfice" valeur="—" detailValeur="12 prix d’achat manquent" fin="chevron" onClick={() => {}}/>
          </Groupe>
          <Groupe titre="À régler" repli={{ ouvert: repli, onBascule: () => setRepli((v) => !v), n: 4 }}>
            {rangeeDe(PAIRES[2])}
          </Groupe>
        </Case>
      </Section>

      <Section titre="Affiche">
        <Case g="affiche:jour" legende="le chiffre du jour" nu>
          <Groupe><Affiche valeur="186" unite="€" libelle="vendus aujourd’hui · 4 ventes" ecart="42 € de plus qu’hier"/></Groupe>
        </Case>
        <Case g="affiche:quatre" legende="4 chiffres · écart à rattraper" nu>
          <Groupe><Affiche valeur="12 480,50" unite="€" libelle="vendus cette année · au moins, sur 412 ventes" ecart="URSSAF à déclarer avant le 31" tonEcart="ambre"/></Groupe>
        </Case>
        <Case g="affiche:passu" legende="pas su" nu>
          <Groupe><Affiche valeur={null} unite="€" libelle="vendus aujourd’hui · la lecture de Vinted n’a pas répondu"/></Groupe>
        </Case>
      </Section>

      <Section titre="Faits">
        <Case g="faits:fiche" legende="la fiche : chaque valeur se touche ; « — » ouvre sa saisie" nu>
          <Groupe>
            <Faits colonnes={2}>
              <Fait libelle="Prix" valeur="45 €" onModifier={() => noter('prix')}/>
              <Fait libelle="Prix mini" valeur="38 €" onModifier={() => {}}/>
              <Fait libelle="Acheté" valeur={null} onModifier={() => noter('achat')} attrs={{ 'data-g-fait-vide': '' }}/>
              <Fait libelle="Bénéfice" valeur={null}/>
              <Fait libelle="Taille" valeur="42 ⅔"/>
              <Fait libelle="En ligne depuis" valeur="23 jours" ton="ambre"/>
              <Fait libelle="Place" valeur="Étagère B · case 3" onModifier={() => {}} attrs={{ 'data-n-force': 'appui' }}/>
              <Fait libelle="Favoris" valeur="1 284" detail="dont 3 cette semaine"/>
            </Faits>
          </Groupe>
        </Case>
        <Case g="faits:quatre" legende="4 colonnes (2 sous 430 px)" nu>
          <Groupe>
            <Faits colonnes={4}>
              <Fait libelle="Vendu" valeur="2 480 €"/>
              <Fait libelle="Reçu" valeur="1 912 €"/>
              <Fait libelle="Bénéfice" valeur="—"/>
              <Fait libelle="Ventes" valeur="31"/>
            </Faits>
          </Groupe>
        </Case>
      </Section>

      <Section titre="Plaque et Pastille">
        <Case g="plaque:toutes" legende="N° : 1 à 4 chiffres, lettre, grand, doublon (le seul rouge)">
          <div className="g-ligne">
            <Plaque numero={7}/><Plaque numero={124}/><Plaque numero={1234}/><Plaque numero="B230"/><Plaque numero={124} grand/><Plaque numero={88} doublon/><Plaque numero={1288} doublon grand/>
          </div>
        </Case>
        <Case g="pastille:toutes" legende="neutre · accent · ambre · ambre plein · doublon">
          <div className="g-ligne">
            <Pastille>{4}</Pastille><Pastille>{128}</Pastille><Pastille ton="accent">En ligne</Pastille><Pastille ton="ambre">À envoyer</Pastille><Pastille ton="ambre-plein">{3}</Pastille><Pastille ton="ambre-plein">{12}</Pastille><Pastille ton="doublon">Doublon</Pastille>
          </div>
        </Case>
      </Section>

      <Section titre="ChampRecherche et Interrupteur">
        <Case g="recherche:vide" legende="vide, scanner dans le champ" nu><div className="g-marge"><ChampRecherche valeur={q} onChange={setQ} placeholder="N°, titre, acheteur" onScanner={() => noter('scanner')}/></div></Case>
        <Case g="recherche:pleine" legende="avec une saisie longue" nu><div className="g-marge"><ChampRecherche valeur="Adidas Samba OG Cloud White Core Black Gum 41 ⅓" onChange={() => {}} onScanner={() => {}}/></div></Case>
        <Case g="interrupteur:seul" legende="interrupteur">
          <div className="g-ligne">
            <label className="g-cible"><Interrupteur actif libelle="Activé" onChange={() => {}}/></label>
            <label className="g-cible"><Interrupteur actif={false} libelle="Éteint" onChange={() => {}}/></label>
          </div>
        </Case>
      </Section>

      <Section titre="Vide et Attente">
        <Case g="vide:geste" legende="icône, une phrase, un geste" nu>
          <Vide icone={<Icon name="box" size={40}/>} phrase="Aucun colis à envoyer." action={<Bouton>Voir les ventes</Bouton>}/>
        </Case>
        <Case g="attente:rangees" legende="squelette · rangées 72 (la forme exacte)" nu><Attente forme="rangees" n={3} vignette={56} titre/></Case>
        <Case g="attente:affiche" legende="squelette · affiche" nu><div className="n-groupe"><div className="n-groupe-carte"><Attente forme="affiche"/></div></div></Case>
        <Case g="attente:faits" legende="squelette · faits" nu><div className="n-groupe"><div className="n-groupe-carte"><Attente forme="faits" n={4}/></div></div></Case>
      </Section>

      <Section titre="Feuille et Toast">
        <Case g="feuille:ouvrir" legende="la feuille (moitié ↔ pleine) et le toast annulable">
          <div className="g-ligne">
            <Bouton onClick={() => setFeuille(true)} attrs={{ 'data-g-ouvrir-feuille': '' }}>Ouvrir la feuille</Bouton>
            <Bouton variante="texte" onClick={() => setToast({ id: Date.now() })} attrs={{ 'data-g-ouvrir-toast': '' }}>Montrer le toast</Bouton>
          </div>
        </Case>
        <Case g="toast:fige" legende="toast (figé dans la page pour la photo)">
          <div className="g-toast-fige"><Toast message="Marqué envoyé · N° 124" onAnnuler={() => {}} duree={3600000}/></div>
        </Case>
      </Section>

      <Section titre="BarreOnglets et BarreLaterale">
        <Case g="onglets:barre" legende="5 onglets de même largeur, pastille lisible" nu>
          <div className="g-onglets-fige"><BarreOnglets onglets={ONGLETS} actif="ventes" onChoisir={() => {}}/></div>
        </Case>
        <Case g="laterale:barre" legende="la barre latérale (ordinateur)" nu>
          <div className="g-laterale-fige"><BarreLaterale groupes={[{ entrees: ONGLETS.map((o) => ({ ...o, icone: o.iconeLaterale })) }, { titre: 'Plus', entrees: PLUS[0].entrees.map((o) => ({ ...o, icone: o.iconeLaterale })) }]} actif="ventes" onChoisir={() => {}}/></div>
        </Case>
      </Section>

      <Feuille ouverte={feuille} onFermer={() => setFeuille(false)} titre="Prix d’achat" detente="moitie" detentes={['moitie', 'pleine']}
        pied={<Bouton variante="plein" onClick={() => { noter('enregistre'); setFeuille(false); }}>Enregistrer</Bouton>}>
        <Groupe titre="N° 124 · Nike Air Max 90">
          <Rangee titre="Montant" valeur="45 €" onClick={() => {}} fin="chevron"/>
          <Rangee titre="Acheté le" valeur="12 novembre" onClick={() => {}} fin="chevron"/>
          <Rangee titre="Frais compris" interrupteur={{ actif: inter, onChange: setInter }}/>
        </Groupe>
      </Feuille>
      {toast ? <Toast key={toast.id} message="Marqué envoyé · N° 124" onAnnuler={() => noter('annule')} onFin={() => setToast(null)}/> : null}
    </div>
  );
}

// ── La coque, avec un écran « Ventes » inventé (téléphone, ordinateur deux volets, trois volets) ──
function EcranVentes({ onOuvrir, ouverte }) {
  const [seg, setSeg] = React.useState('envoyer');
  if (BASE_VIDE) {
    return (
      <Page titre="Ventes">
        <Segmente libelle="Filtrer les ventes" valeur={seg} onChange={setSeg} options={[{ cle: 'envoyer', libelle: 'À envoyer' }, { cle: 'route', libelle: 'En route' }, { cle: 'finies', libelle: 'Finies' }]}/>
        <Vide icone={<Icon name="truck" size={40}/>} phrase="Aucune vente pour l’instant." action={<Bouton>Publier une annonce</Bouton>}/>
      </Page>
    );
  }
  return (
    <Page titre="Ventes" plein={<Bouton variante="plein" icone={<Icon name="printer" size={20}/>}>Imprimer 3 bordereaux</Bouton>}>
      <Segmente libelle="Filtrer les ventes" valeur={seg} onChange={setSeg} options={[{ cle: 'envoyer', libelle: 'À envoyer', n: 3 }, { cle: 'route', libelle: 'En route', n: 12 }, { cle: 'finies', libelle: 'Finies' }]}/>
      <Groupe titre="À envoyer" pied="3 bordereaux prêts sur 4">
        {PAIRES.slice(0, 4).map((p) => rangeeDe(p, { selectionnee: ouverte === p.id, onClick: () => onOuvrir(p), attrs: { 'data-g-vente': p.id } }))}
      </Groupe>
      <Groupe titre="En route">
        {[...PAIRES, ...PAIRES, ...PAIRES].map((p, i) => rangeeDe({ ...p, id: p.id + i }, { onClick: () => onOuvrir(p) }))}
      </Groupe>
    </Page>
  );
}
function Fiche({ p, onRetour }) {
  return (
    <PagePoussee ouverte={!!p} titre={p ? 'N° ' + p.n : ''} libelleRetour="Ventes" onRetour={onRetour}
      plein={<Bouton variante="plein">Imprimer le bordereau</Bouton>} attrs={{ 'data-g-fiche': '' }}>
      {p ? (
        <>
          <Groupe>
            <Rangee vignette={<Vignette src={p.ph} alt=""/>} titre={p.titre} lignes={2} plaque={<Plaque numero={p.n}/>} sousTitre={p.etat}/>
          </Groupe>
          <Groupe>
            <Faits colonnes={2}>
              <Fait libelle="Prix" valeur={p.prix} onModifier={() => {}}/>
              <Fait libelle="Prix mini" valeur="38 €" onModifier={() => {}}/>
              <Fait libelle="Acheté" valeur={null} onModifier={() => {}}/>
              <Fait libelle="Bénéfice" valeur={null}/>
              <Fait libelle="Taille" valeur={p.taille}/>
              <Fait libelle="En ligne depuis" valeur="23 jours"/>
            </Faits>
          </Groupe>
          <Groupe titre="Sites">
            <Rangee titre="Vinted" sousTitre="jujuf38" valeur="en ligne" fin="chevron" onClick={() => {}}/>
            <Rangee titre="Leboncoin" valeur="à publier" fin="chevron" onClick={() => {}}/>
          </Groupe>
        </>
      ) : null}
    </PagePoussee>
  );
}
function VueCoque({ trois }) {
  const [tab, setTab] = React.useState('ventes');
  const [p, setP] = React.useState(P.get('fiche') ? PAIRES[0] : null);
  const [q, setQ] = React.useState('');
  const titres = { aujourdhui: 'Aujourd’hui', annonces: 'Annonces', ventes: 'Ventes', achats: 'Achats', argent: 'Argent', stock: 'Stock', messages: 'Messages', emails: 'E-mails', sante: 'Tout va bien ?', reglages: 'Paramètres', communaute: 'Communauté' };
  return (
    <Coque
      onglets={ONGLETS} plus={PLUS} actif={tab} onChoisir={(c) => { setTab(c); setP(null); }} titre={titres[tab]}
      volets={trois ? 'trois' : 'deux'}
      recherche={<ChampRecherche valeur={q} onChange={setQ} placeholder="N°, titre, acheteur" onScanner={() => {}}/>}
      messages={{ n: 12, libelle: 'Messages', libellePastille: 'Messages : 12 non lus', icone: <Icon name="chat" size={24}/>, onOuvrir: () => setTab('messages') }}
      compte={{ initiales: 'JU', nom: 'Julien', sousTitre: '3 comptes Vinted' }}
      marque={<span className="g-marque">VRM</span>}
      detailVide={<Vide icone={<Icon name="tag" size={40}/>} phrase="Choisis une vente pour voir sa fiche."/>}
      plusPied={<Groupe><Rangee icone={<Icon name="help" size={22}/>} titre="Aide" fin="chevron" onClick={() => {}}/><Rangee icone={<Icon name="door" size={22}/>} titre="Se déconnecter" onClick={() => {}}/></Groupe>}
    >
      {tab === 'ventes' ? <EcranVentes onOuvrir={setP} ouverte={p ? p.id : ''}/> : (
        <Page titre={titres[tab]}>
          <Vide icone={<Icon name="box" size={40}/>} phrase={`L’écran « ${titres[tab]} » de la galerie est vide.`}/>
        </Page>
      )}
      <Fiche p={p} onRetour={() => setP(null)}/>
    </Coque>
  );
}

const racine = createRoot(document.getElementById('r'));
racine.render(VUE === 'coque' ? <VueCoque trois={false}/> : VUE === 'coque3' ? <VueCoque trois/> : <Galerie/>);
