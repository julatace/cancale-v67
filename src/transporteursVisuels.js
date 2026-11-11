// ════════════════════════════════════════════════════════════════════════════
//  LES TRANSPORTEURS, À L'ÉCRAN — UN module (2 nov., §11)
//  Julien : « quand je fais une vente, je veux qu'à côté du bouton bordereau,
//  ça soit marqué Chronopost avec le logo Chronopost ou Mondial Relay avec le
//  logo Mondial Relay. Que ça soit pour les ventes et les achats » ; « dans les
//  colis je veux que tu mettes les transporteurs, après on fera des stats ».
//
//  Ici : QUI transporte un colis (`transporteurDuColis`) et COMMENT on l'écrit
//  (nom + logo). Une seule source pour chaque carte de colis, et pour les
//  statistiques à venir (`cleStatTransporteur`, posée en `data-transporteur`).
//
//  ⚠️ LE TRANSPORTEUR EST TOUJOURS LU, JAMAIS DEVINÉ (§5). Dans l'ordre :
//    1. la ligne lue CHEZ le transporteur pour ce n° (`transp_{c}_{n°}`, écrite
//       par le serveur seul) — c'est lui qui a répondu ;
//    2. ce que la PLATEFORME écrit (Vestiaire « Chronopost », Leboncoin
//       `deliveryMethod`, la conversation Vinted d'un achat, le transporteur
//       d'un e-mail) — et un e-mail de transporteur du MÊME n° ;
//    3. la FORME du n° quand elle ne désigne qu'un transporteur
//       (`transporteurDeForme` : 8 chiffres, 2 lettres + 9 chiffres + 2 lettres,
//       « VGS… » — mesurée sur ses 193 n°).
//  Rien de tout ça ⇒ « Transporteur pas lu », sans logo. Un e-mail
//  `shipping@relay.vinted.com` est rangé « vinted » PAR DÉFAUT par la route des
//  e-mails : ce n'est pas une preuve face à un transporteur NOMMÉ du même n°, ni
//  face à un n° de forme Chronopost stricte (la règle de `carrierLisible`).
//
//  ⚠️ LES LOGOS (9 nov. au soir, Julien : « je veux que ce soient les LOGOS des
//  transporteurs qui soient affichés à côté des colis et non les noms »). Les logos
//  officiels sont des marques déposées SANS licence d'usage publiée (aucun des
//  transporteurs ne publie de kit libre) ; les icônes de site chargées avant depuis
//  leurs domaines (favicon) n'avaient pas de licence non plus, échouaient hors réseau
//  et révélaient l'adresse du vendeur à chaque transporteur. Donc : une MARQUE MAISON
//  (`marque`) — une tuile aux couleurs du transporteur et son sigle, dessinée en SVG
//  ici, sans aucun fichier ni requête — qui le désigne sans copier son logo.
//  Inconnu ⇒ un pictogramme neutre (un carton gris), jamais une fausse marque.
// ════════════════════════════════════════════════════════════════════════════
import { transporteurDeForme, colisInternational } from '../api/_lib/suivi-colis.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';

// ⚠️⚠️ (10 nov.) LES VRAIS LOGOS. Julien, sur captures iPhone : « Je veux que ce soit le logo
// Mondial Relay et Chronopost, lorsque c'est des colis Chronopost / Mondial Relay ». Les marques
// maison (un sigle « MR », « CH ») ne se reconnaissaient pas. Usage NOMINATIF (désigner le
// transporteur d'un colis), accepté par lui. Toujours dessinés ICI en SVG (aucun fichier, aucune
// requête : rien ne part chez le transporteur, rien ne casse hors réseau). Sources :
//   · Mondial Relay : tracé d'après le logo publié dans le paquet npm `@ovh-ux/ng-ovh-mondial-relay`
//     (image 300×185 : « r » blanc, rond et carré grèges sur framboise #C90547 — couleurs relevées) ;
//   · UPS, DPD, DHL, FedEx, Vinted (le V de Vinted Go) : tracés de `simple-icons` 16.37 (CC0), aux
//     couleurs de marque que ce paquet publie (® retiré) ;
//   · Chronopost, Colissimo, InPost, Relais Colis, Shop2Shop, GLS, Colis Privé : aucun tracé libre
//     trouvé hors réseau ⇒ leur mot-symbole écrit aux couleurs de leur logo public (à comparer à
//     un vrai colis ; un tracé exact se pose ici, à la même clé, sans rien changer d'autre).
// `svg` : le dessin dans une tuile 32×32 (fond `fond`). Valeurs FIGÉES (jamais une donnée lue).
export const DESSINS_TRANSPORTEURS = Object.freeze({
  mondialrelay: { fond: '#C90547', svg: `<g transform="translate(8.5 5) scale(.2785) translate(-125 -13)"><circle cx="144" cy="22.8" r="9.5" fill="#CFC8BF"/><rect x="163" y="38.5" width="16" height="16" fill="#CFC8BF"/><path d="M125 92V61.5A23 23 0 0 1 148 38.5H159V54.5H149A7 7 0 0 0 142 61.5V92Z" fill="#FFFFFF"/></g>` },
  ups: { fond: '#351C15', svg: `<g transform="translate(4.6 4) scale(1)"><path fill="#FFB500" d="M11.668 14.544l-.028-5.226c.138-.055.387-.111.608-.111.995 0 1.41.774 1.41 2.682 0 1.853-.47 2.765-1.438 2.765-.22 0-.441-.055-.552-.11zM3.124 7.438c4.203-3.843 9.29-4.866 14.018-4.866 1.3 0 2.544.083 3.76.194h-.028v11.253c0 2.184-.774 3.926-2.295 5.171-1.355 1.134-5.447 2.959-6.581 3.456-1.161-.525-5.253-2.378-6.581-3.456-1.493-1.244-2.295-3.014-2.295-5.171V7.438zm12.664 2.599c.028.912.276 1.576 1.687 2.406.747.442 1.051.747 1.051 1.272 0 .581-.387.94-1.023.94-.553 0-1.189-.304-1.631-.691v1.576c.553.304 1.217.525 1.88.525 1.687 0 2.433-1.189 2.461-2.267.028-.995-.249-1.742-1.659-2.571-.608-.387-1.134-.636-1.106-1.244 0-.581.525-.802.995-.802.581 0 1.161.332 1.521.691V8.378c-.304-.221-.94-.581-1.88-.553-1.135.028-2.296.829-2.296 2.212zm-5.834 9.484h1.714l-.028-3.594c.166.028.415.083.774.083 1.908 0 2.986-1.687 2.986-4.175 0-2.461-1.106-4.009-3.152-4.009-.94 0-1.687.221-2.295.608v11.087zm-5.945-6.166c0 1.797.829 2.71 2.516 2.71 1.051 0 1.908-.249 2.571-.691V7.991H7.41v6.387c-.194.138-.47.221-.802.221-.774 0-.885-.719-.885-1.189V7.991H4.009v5.364zM22.12 2.295v11.723c0 2.516-.94 4.645-2.765 6.111-1.549 1.3-6.332 3.429-7.355 3.871-1.023-.442-5.806-2.571-7.355-3.843-1.797-1.465-2.765-3.594-2.765-6.111V2.295C4.756.747 8.074 0 12 0s7.244.747 10.12 2.295zm-.304.221c-2.71-1.465-6-2.184-9.788-2.184s-7.079.746-9.788 2.184v11.502c0 2.433.912 4.452 2.627 5.862 1.576 1.3 6.581 3.484 7.161 3.76.581-.249 5.585-2.433 7.161-3.733 1.714-1.41 2.627-3.429 2.627-5.862V2.516z"/></g>` },
  dpd: { fond: '#FFFFFF', svg: `<g transform="translate(4.5 4.5) scale(.96)"><path fill="#DC0032" d="M16.01 10.71a.364.364 0 01-.343-.006l-.558-.331a.43.43 0 01-.182-.312l-.014-.65a.363.363 0 01.165-.3l6.7-3.902L12.377.085A.799.799 0 0012 0a.798.798 0 00-.377.085l-9.4 5.124 10.53 6.13c.098.054.172.181.172.295v8.944c0 .112-.08.241-.178.294l-.567.315c-.171.062-.256.043-.361 0l-.569-.315a.362.362 0 01-.175-.294v-7.973a.223.223 0 00-.095-.156L1.702 7.048v10.579c0 .236.167.528.371.648l9.556 5.636c.102.06.237.09.371.089a.745.745 0 00.371-.09l9.557-5.635a.835.835 0 00.37-.648V7.047Z"/></g>` },
  dhl: { fond: '#FFCC00', svg: `<g transform="translate(1 2) scale(1.25)"><path fill="#D40511" d="M4.22 10.303l-.767 1.043h4.18c.21 0 .208.078.105.218-.105.142-.28.39-.386.534-.054.073-.154.207.171.207h1.71l.505-.69c.314-.426.028-1.312-1.095-1.312H4.22zm7.204 0l-1.475 2.002h5.39l1.473-2.002H14.61l-.843 1.146h-.985l.846-1.146h-2.203zm6.105 0l-1.474 2.002h2.334l1.472-2.002H17.53zm-12.845 1.3l-1.54 2.094h3.754c1.24 0 1.932-.844 2.145-1.136h-2.56c-.326 0-.226-.133-.172-.207.107-.143.283-.388.388-.53.104-.14.107-.22-.105-.22h-1.91zM0 12.562v.242h3.398l.176-.242H0zm9.762 0l-.836 1.136h2.203l.836-1.136H9.762zm3.185 0l-.836 1.136h2.203l.836-1.136h-2.203zm2.918 0s-.159.22-.238.326c-.276.374-.033.81.87.81h3.538l.834-1.136h-5.004zm5.408 0l-.177.242H24v-.242h-2.727zM0 13.01v.24h3.068l.178-.24H0zm20.943 0l-.175.24H24v-.24h-3.057zM0 13.457v.24h2.74l.176-.24H0zm20.615 0l-.177.24H24v-.24h-3.385z"/></g>` },
  fedex: { fond: '#FFFFFF', svg: `<svg x="1.5" y="11.6" width="29" height="9.1" viewBox="0 8.6 21.95 6.9" overflow="hidden"><path fill="#4D148C" d="M22.498 14.298c-.016-.414.345-.751.75-.755a.745.745 0 0 1 .752.755.755.755 0 0 1-.751.745c-.395.002-.759-.346-.751-.745zm.759-.083c.067-.02.164-.042.162-.13.007-.09-.086-.133-.162-.134h-.163v.263c0 .001.165-.002.163.001zm-.163.107v.418h-.14v-.91h.327c.156-.021.294.092.286.253a.218.218 0 0 1-.156.19c.162.083.108.322.173.467h-.156a2.355 2.355 0 0 1-.04-.205c-.018-.093-.047-.229-.17-.213h-.124zm.76-.024a.603.603 0 0 0-.605-.632c-.338-.012-.62.302-.605.632a.619.619 0 0 0 .605.622.61.61 0 0 0 .605-.622zm-5.052-.579l-.878 1.008h-1.306l1.559-1.745-1.56-1.75h1.355l.902.997.878-.998h1.306l-1.543 1.743 1.559 1.753h-1.371l-.901-1.008zm-4.703-.352v-.827h1.904v-1.506l1.724 1.948-1.724 1.941v-1.556h-1.904zm1.56 1.36h-3.2V9.044h3.224v1.024H13.77v1.163h1.888v.958h-1.904v1.522h1.904v1.016zm-5.705-.655c-.54.017-.878-.552-.877-1.04-.01-.507.307-1.123.878-1.105.579-.025.871.6.845 1.103.023.501-.29 1.062-.846 1.042zM4.743 12.41c.076-.358.403-.67.78-.663a.788.788 0 0 1 .803.663H4.743zm15.182.564l1.815-2.047h-2.125l-.74.844-.763-.844h-4.037v-.548h1.912V8.741H10.84v2.58c-.362-.448-.981-.559-1.526-.492-.782.123-1.427.762-1.634 1.514-.254-.958-1.179-1.588-2.157-1.554-.781.009-1.6.365-1.987 1.071v-.818h-1.87v-.9h2.043v-1.4H0v6.287h1.666v-2.644h1.666a7.59 7.59 0 0 0-.082.622c-.013 1.232 1.042 2.27 2.274 2.236a2.204 2.204 0 0 0 2.157-1.432H6.254c-.14.268-.441.38-.73.36-.457.009-.83-.417-.829-.86h2.914c.083 1.027.988 1.966 2.043 1.947a1.53 1.53 0 0 0 1.19-.639v.41h7.215l.754-.86.754.86h2.192l-1.832-2.055z"/></svg>` },
  vinted: { fond: '#007782', svg: `<g transform="translate(5 5) scale(.92)"><path fill="#FFFFFF" d="M19.316 0c-.258 0-.571.217-1.415.953-.3.108-.627.027-1.008.613-2.15 3.09-3.825 14.648-5.255 17.984-.286-1.444-.885-10.837-1.116-13.41-.028-.477.027-1.076.027-1.43 0-2.368-.516-3.567-2.886-3.567-1.198 0-2.382.436-3.008 1.226-.299.408-.409.708-.409 1.443 0 4.915 1.171 12.973 2.478 18.228C7.132 23.688 8.603 24 9.99 24c.654 0 1.307-.081 2.233-.544 3.212-1.567 4.07-5.84 4.9-9.993.15-.749.899-4.37 1.253-6.275.476-2.6 1.02-5.54 1.347-6.617C19.833.245 19.63 0 19.317 0z"/></g>` },
  // (11 nov., Julien : « le logo Chronopost est toujours pas bon ») Le pictogramme IMPRIMÉ sur ses
  // bordereaux Chronopost (relevé sur une vraie étiquette, retournée à l'endroit) : un cube en hexagone,
  // couvercle entrouvert — la fente gauche et la verticale jusqu'au bas, la droite arrêtée aux deux tiers.
  // Encre noire sur blanc, comme sur l'étiquette.
  chronopost: { fond: '#FFFFFF', svg: `<g transform="translate(5 4.4) scale(.55)"><path fill="#1D1D1B" d="M20 0L40 11V30.5L20 42L0 30.5V11Z"/><path d="M0 11.2L20 21.8V42M20 21.8L31.6 15.4" fill="none" stroke="#FFFFFF" stroke-width="3.8"/></g>` },
  colissimo: { fond: '#FFD100', svg: `<path d="M6 21.5c3.5 3.3 10.5 4 16 .2" fill="none" stroke="#1D2C5E" stroke-width="1.6" stroke-linecap="round"/><text x="16" y="18.2" text-anchor="middle" fill="#1D2C5E" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="9.4" letter-spacing="-0.4" textLength="26" lengthAdjust="spacingAndGlyphs">colissimo</text>` },
  inpost: { fond: '#FFCD00', svg: `<text x="16" y="15.2" text-anchor="middle" fill="#1D1D1B" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="11" letter-spacing="-0.4">In</text><text x="16" y="25.4" text-anchor="middle" fill="#1D1D1B" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="10.4" letter-spacing="-0.5" textLength="21" lengthAdjust="spacingAndGlyphs">Post</text>` },
  relaiscolis: { fond: '#E2001A', svg: `<text x="16" y="14.6" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.8" letter-spacing="-0.3" textLength="22" lengthAdjust="spacingAndGlyphs">Relais</text><text x="16" y="24.4" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.8" letter-spacing="-0.3" textLength="20" lengthAdjust="spacingAndGlyphs">Colis</text>` },
  shop2shop: { fond: '#00A0DF', svg: `<text x="16" y="14.4" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.6" letter-spacing="-0.3" textLength="21" lengthAdjust="spacingAndGlyphs">Shop2</text><text x="16" y="24.2" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.6" letter-spacing="-0.3" textLength="18" lengthAdjust="spacingAndGlyphs">Shop</text>` },
  gls: { fond: '#061AB1', svg: `<text x="16" y="20.4" text-anchor="middle" fill="#FFD100" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="12.5" letter-spacing="-0.4" textLength="22" lengthAdjust="spacingAndGlyphs">GLS</text>` },
  colisprive: { fond: '#EE7203', svg: `<text x="16" y="14.6" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.8" letter-spacing="-0.3" textLength="20" lengthAdjust="spacingAndGlyphs">Colis</text><text x="16" y="24.4" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="8.8" letter-spacing="-0.3" textLength="20" lengthAdjust="spacingAndGlyphs">Privé</text>` },
});

export const PAS_LU = 'Transporteur inconnu';  // (3 nov., critique #15) des mots simples, pas « pas lu »

// `marque` : { fond, encre, sigle } — la tuile maison (src/PastilleTransporteur.jsx).
// Couleurs : celles que chaque transporteur montre sur ses colis et ses points (repères
// publics), jamais son dessin. `logos` reste (vide) pour les anciens appelants.
export const TRANSPORTEURS = Object.freeze({
  chronopost:   { nom: 'Chronopost',    logos: [], marque: { fond: '#0057A8', encre: '#FFFFFF', sigle: 'CH' } },
  mondialrelay: { nom: 'Mondial Relay', logos: [], marque: { fond: '#C8102E', encre: '#FFFFFF', sigle: 'MR' } },
  colissimo:    { nom: 'Colissimo',     logos: [], marque: { fond: '#FFD100', encre: '#1D2C5E', sigle: 'CO' } },
  vinted:       { nom: 'Vinted Go',     logos: [], marque: { fond: '#007782', encre: '#FFFFFF', sigle: 'VG' } },
  relaiscolis:  { nom: 'Relais Colis',  logos: [], marque: { fond: '#7A1F6B', encre: '#FFFFFF', sigle: 'RC' } },
  dpd:          { nom: 'DPD',           logos: [], marque: { fond: '#DC0032', encre: '#FFFFFF', sigle: 'DPD' } },
  ups:          { nom: 'UPS',           logos: [], marque: { fond: '#351C15', encre: '#FFB500', sigle: 'UPS' } },
  gls:          { nom: 'GLS',           logos: [], marque: { fond: '#061AB1', encre: '#FFD100', sigle: 'GLS' } },
  colisprive:   { nom: 'Colis Privé',   logos: [], marque: { fond: '#EE7203', encre: '#FFFFFF', sigle: 'CP' } },
  shop2shop:    { nom: 'Shop2Shop',     logos: [], marque: { fond: '#00A0DF', encre: '#FFFFFF', sigle: 'S2' } },
  inpost:       { nom: 'InPost',        logos: [], marque: { fond: '#FFCD00', encre: '#1D1D1B', sigle: 'IP' } },
  dhl:          { nom: 'DHL',           logos: [], marque: { fond: '#FFCC00', encre: '#D40511', sigle: 'DHL' } },
  fedex:        { nom: 'FedEx',         logos: [], marque: { fond: '#4D148C', encre: '#FFFFFF', sigle: 'FX' } },
});

const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le transporteur d'un TEXTE écrit par une source (clé rangée « mondialrelay »,
// libellé « Mondial Relay », `deliveryMethod` « mondial_relay »…). `null` si
// le texte ne nomme aucun transporteur connu (« autre », vide, inconnu).
export function cleTransporteur(raw) {
  const s = sansAccents(raw).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/mondial/.test(s)) return 'mondialrelay';
  if (/shop ?2 ?shop/.test(s)) return 'shop2shop';
  if (/chrono|pickup/.test(s)) return 'chronopost';
  if (/relais ?colis/.test(s)) return 'relaiscolis';
  if (/colis ?prive/.test(s)) return 'colisprive';
  if (/coliss|la ?poste|laposte/.test(s)) return 'colissimo';
  if (/vinted/.test(s)) return 'vinted';
  // (11 nov., Julien : « InPost est avec Mondial Relay ») le même réseau : un colis InPost se range avec Mondial Relay.
  if (/inpost/.test(s)) return 'mondialrelay';
  if (/\bdpd\b/.test(s)) return 'dpd';
  if (/\bups\b/.test(s)) return 'ups';
  if (/\bgls\b/.test(s)) return 'gls';
  if (/\bdhl\b/.test(s)) return 'dhl';
  if (/fedex/.test(s)) return 'fedex';
  return null;
}

export const nomDuTransporteur = (cle) => (cle && TRANSPORTEURS[cle] ? TRANSPORTEURS[cle].nom : '');
export const logosDuTransporteur = (cle) => (cle && TRANSPORTEURS[cle] ? TRANSPORTEURS[cle].logos.slice() : []);
export const marqueDuTransporteur = (cle) => (cle && TRANSPORTEURS[cle] ? { ...TRANSPORTEURS[cle].marque, ...(DESSINS_TRANSPORTEURS[cle] || {}) } : null);
// La même tuile en SVG texte, pour un élément créé hors de React (l'épingle de la carte des relais).
// Les valeurs viennent de la table figée ci-dessus (jamais d'une donnée lue) : rien à échapper.
export function svgMarque(cle, taille = 18) {
  const m = marqueDuTransporteur(cle);
  if (!m) return '';
  const r = Math.round(taille * 0.26);
  return `<svg viewBox="0 0 32 32" width="${taille}" height="${taille}" aria-hidden="true" focusable="false" data-marque="${cle}" style="display:block;border-radius:${r}px;flex:none;overflow:hidden"><rect width="32" height="32" rx="8" fill="${m.fond}"/>${m.svg || ''}</svg>`;
}

const CHRONO_STRICT = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
// Un transporteur NOMMÉ l'emporte sur « vinted » (le défaut d'un e-mail shipping@).
const rang = (c) => (!c ? 0 : c === 'vinted' ? 1 : 2);

const ligneTranspDe = (transp, n) => {
  if (!transp || !n) return null;
  if (typeof transp.get === 'function') return transp.get(n) || null;
  if (Array.isArray(transp)) return transp.find((t) => t && normaliserSuivi(t.suivi) === n) || null;
  return null;
};

// Le transporteur d'UN colis. Entrées (toutes facultatives) :
//   declare     — le texte qu'écrit la plateforme ou l'e-mail du colis ;
//   suivi       — son n° de suivi ;
//   transp      — les lignes lues chez les transporteurs (Map par n° ou liste) ;
//   suivisEmail — les e-mails de suivi (`email_track_*`, { suivi, carrier }).
// Rend { cle, nom, source } — `cle` null et `nom` '' quand rien n'est lu ;
// `nom` seul (cle null) quand la plateforme écrit un transporteur que VRM ne
// connaît pas : il est LU, on le recopie tel quel, sans logo.
// `source` : 'transporteur' · 'plateforme' · 'email' · 'forme' · null.
// (7 nov., vitesse) Les e-mails de suivi rangés par n° normalisé, une fois par
// liste (la liste est une valeur : une nouvelle lecture est une nouvelle liste).
// Avant : chaque colis relisait et renormalisait TOUS les e-mails (Colis :
// ~0,5 s au téléphone). Mêmes lignes, dans le même ordre.
const _emailsParSuivi = new WeakMap();
function emailsDuSuivi(liste, n) {
  let m = _emailsParSuivi.get(liste);
  if (!m) {
    m = new Map();
    for (const l of liste) {
      if (!l) continue;
      const k = normaliserSuivi(l.suivi);
      if (!k) continue;
      const a = m.get(k); if (a) a.push(l); else m.set(k, [l]);
    }
    _emailsParSuivi.set(liste, m);
  }
  return m.get(n) || [];
}

export function transporteurDuColis({ declare = '', suivi = '', transp = null, suivisEmail = null } = {}) {
  const n = normaliserSuivi(suivi);
  const t = ligneTranspDe(transp, n);
  // (6 nov.) La ligne du transporteur ne NOMME le transporteur que s'il a RÉPONDU
  // (un état lu, une lecture datée) : une ligne `transp_chronopost_…` créée par un
  // essai qui n'a jamais abouti n'est que l'endroit où on a frappé, pas une preuve.
  // ⚠️ (6 nov., statut des colis) `fini` n'est PAS une réponse : le serveur le pose aussi
  // quand il ABANDONNE (« introuvable » trois fois, suivi expiré — `finiApres`). Mesuré sur sa
  // base : 3 lignes `transp_chronopost_…IE` « introuvable », fini, jamais lues, nommaient
  // « Chronopost » sur un colis postal irlandais. Seule une lecture réussie nomme.
  const cT = t && (t.lu || t.etat) ? cleTransporteur(t.carrier) : null;
  if (cT) return { cle: cT, nom: nomDuTransporteur(cT), source: 'transporteur' };
  let cle = null, source = null;
  const prendre = (c, s) => { if (c && rang(c) > rang(cle)) { cle = c; source = s; } };
  let cD = cleTransporteur(declare);
  // Le « vinted » par défaut d'un e-mail ne vaut rien face à un n° Chronopost strict.
  if (cD === 'vinted' && CHRONO_STRICT.test(n)) cD = null;
  prendre(cD, 'plateforme');
  if (n && Array.isArray(suivisEmail)) {
    for (const l of emailsDuSuivi(suivisEmail, n)) {
      let c = cleTransporteur(l.carrier);
      if (c === 'vinted' && CHRONO_STRICT.test(n)) c = null;
      prendre(c, 'email');
    }
  }
  if (cle && rang(cle) === 2) return { cle, nom: nomDuTransporteur(cle), source };
  const cF = n ? transporteurDeForme(n) : null;
  if (cF) return { cle: cF, nom: nomDuTransporteur(cF), source: 'forme' };
  if (cle) return { cle, nom: nomDuTransporteur(cle), source };
  // (6 nov.) Un n° postal international (S10 « …IE ») : son PAYS, lu dans le n°,
  // jamais un transporteur deviné (suivi-colis.js, `colisInternational`).
  const inter = colisInternational(n);
  if (inter && !String(declare || '').trim()) return { cle: null, nom: inter, source: 'pays' };
  // Un transporteur écrit mais inconnu de VRM : recopié tel quel (borné).
  const brut = String(declare == null ? '' : declare).replace(/\s+/g, ' ').trim();
  if (brut && !/^(autre|generic|transporteur|colis|other)$/i.test(brut) && !/^[a-z0-9_]+$/.test(brut)) return { cle: null, nom: brut.slice(0, 30), source: 'plateforme' };
  return { cle: null, nom: '', source: null };
}

// La clé pour les STATISTIQUES par transporteur (une seule source, celle de la
// carte) : la clé connue, « autre » pour un nom lu mais inconnu, « pas-lu ».
export const cleStatTransporteur = (t) => (t && t.cle ? t.cle : (t && t.nom ? 'autre' : 'pas-lu'));
