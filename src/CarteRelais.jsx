// ════════════════════════════════════════════════════════════════════════════
//  LA CARTE DES POINTS RELAIS — Colis → « À retirer » (31 octobre)
//  Une épingle par point relais, avec le NOMBRE de colis (arrivés + attendus),
//  et sous la carte la liste par point : les colis déjà là (avec ou sans code),
//  ceux qui y vont avec leur arrivée ESTIMÉE (celle que Vinted donne, dite
//  « estimée ») ou « date pas encore dite ».
//  · Le regroupement vient de `src/relaisColis.js` (règle pure, par identité).
//  · Le fond : OpenFreeMap + MapLibre (src/fondCarte.js — la carte de la
//    communauté ; un seul domaine de tuiles, déjà dans la CSP). Rien ne charge
//    tant que la carte n'est pas dépliée.
//  · Le repère d'un point : d'abord la position que VINTED donne pour ce point
//    (sa liste de points relais, par nom + code postal — `repereDepuisPointsVinted`) ;
//    sinon la Base Adresse Nationale (api-adresse.data.gouv.fr, gratuite, sans
//    clé, déjà dans la CSP), sur l'ADRESSE lue (rue + code postal + ville), gardée
//    seulement si elle est sûre (`repereDepuisBan`). Une adresse incomplète ou
//    incertaine ⇒ le point est listé SANS repère, et la raison est dite — jamais
//    une épingle au centre de la ville. Les repères trouvés sont gardés dans CE
//    navigateur (`vrm_geo_relais_v2`, une commodité : perdu, il coûte une
//    recherche) ; un échec n'est pas redemandé avant 24 h ; une panne de réseau
//    n'est pas notée (réessayée à la prochaine ouverture).
//  · Pas de WebGL, style injoignable ⇒ « carte indisponible ici », la liste reste.
//
//  (1er nov.) `ColonneRetirer` : la colonne « À retirer » de Colis, PAR POINT.
//  Julien : « il n'y a pas tous les points relais, il ne doit pas y avoir
//  d'erreur et ça doit être un peu plus clair ». Chaque point : son numéro (le
//  même que l'épingle), son nom en gras, l'adresse courte, le nombre de colis,
//  la date limite la plus proche (ambre aujourd'hui ou demain), puis ses colis
//  (photo, nom + taille, code de retrait en grand, N°). Les colis sans lieu
//  sont sous « Point pas encore connu », avec la raison et le geste.
// ════════════════════════════════════════════════════════════════════════════
import DansFiche from './DansFiche.jsx';
import { attrsFicheLigne, ouvrirLigne } from './ficheLigne.js';
import React from 'react';
import LigneGlissable from './LigneGlissable.jsx';   // (11 nov., gestes-glisser) « Retiré » / « Le code » au glisser
import { jugerBan, requetesBan, nombreEpingle, RAISONS_BAN, surLaCarte, pointsARetirer } from './relaisColis.js';
import { villeDuPoint as villeDuPointRegle, villesDesPoints as villesDesPointsRegle, selecteurVilles as selecteurVillesRegle, CLE_AUTRES, pointsSansVille as pointsSansVilleRegle, communesDepuisBan, LIMITE_COMMUNES } from './villeRelais.js';
import './styles-colis-colonnes.css';
import './styles-retraits-clairs.css';   // (11 nov.) « À retirer » lisible : code, n° de suivi, titre sur 2 lignes
import PastilleTransporteur, { BadgeTransporteur } from './PastilleTransporteur.jsx';
import { cleStatTransporteur, cleTransporteur, svgMarque } from './transporteursVisuels.js';
import { attrCible } from './cibleNotif.js';
import { NOMS_SOURCES, texteVerifie, verifieAncien, texteNonConfirme } from './sourcesRetrait.js';
import Pourquoi from './composants/PourquoiReplie.jsx';
import { lienItineraire, appareilApple } from './relaisChange.js';
import { horairesDuPoint, texteHoraires, etatOuverture, phraseOuverture } from '../api/_lib/horaires-relais.js';   // (13 nov.) les horaires du point, lus dans l'e-mail

// (5 nov.) Le crochet d'une notification (`data-cible`, src/cibleNotif.js) : la clé
// de la ligne EST son identité — « r:v:<tx> » / « r:c:<tx> » (achat Vinted),
// « r:e:<n° de suivi> » (e-mail du transporteur). Rien d'autre n'est deviné.
export function cibleRetrait(cle) {
  const m = /^r:([vce]):(.+)$/.exec(String(cle || ''));
  if (!m) return undefined;
  return m[1] === 'e' ? attrCible(['retrait', 'suivi', m[2]]) : attrCible(['retrait', 'tx', m[2]]);
}

// (1er nov., « plus fiable ») v2 : la règle a changé (rue + ville sans code
// postal, ville collée à la rue, résultat ambigu refusé) — les échecs notés
// sous l'ancienne règle ne figent plus un point hors de la carte, et un repère
// trouvé sans contrôle de ville n'est plus repris.
const CACHE = 'vrm_geo_relais_v2';
const ECHEC_MS = 24 * 3600e3;
const lireCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || '{}') || {}; } catch (_) { return {}; } };
const ecrireCache = (c) => { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (_) {} };
const cleAdr = (a) => String(a || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Ce qu'on sait déjà de ce point SANS appeler la Base Adresse (le cache) :
// { lat, lon } · { echec: raison } · undefined (à chercher).
function repereEnCache(p) {
  const reqs = requetesBan(p);
  if (!reqs.length) return undefined;
  const c = lireCache()[cleAdr(reqs[0].q)];
  // (3 nov.) Un repère gardé AVANT que la ville du résultat soit notée est recherché une fois.
  if (c && c.lat != null) return c.villeLue === undefined ? undefined : { lat: c.lat, lon: c.lon };
  if (c && c.echec && Date.now() - c.echec < ECHEC_MS) return { echec: c.raison || 'introuvable' };
  return undefined;
}
// Rend { lat, lon } (sûr), { echec: raison } (cherché, pas sûr : noté 24 h) ou
// 'reseau' (la Base Adresse Nationale n'a pas répondu : rien n'est noté).
// (1er nov.) Deux écrans qui cherchent la même adresse en même temps (la colonne
// de Colis et la tournée, ou un effet relancé) partagent UNE requête en cours.
const REQ_EN_COURS = new Map();
function chercherRepere(p) {
  const reqs = requetesBan(p);
  const k = reqs.length ? cleAdr(reqs[0].q) : '';
  if (k && REQ_EN_COURS.has(k)) return REQ_EN_COURS.get(k);
  const pr = chercherRepereReseau(p).finally(() => { if (k) REQ_EN_COURS.delete(k); });
  if (k) REQ_EN_COURS.set(k, pr);
  return pr;
}
async function chercherRepereReseau(p) {
  const reqs = requetesBan(p);
  if (!reqs.length) return { echec: 'introuvable' };
  const k = cleAdr(reqs[0].q);
  let res = null;
  try {
    for (const r of reqs) {
      const rep = await fetch(`https://api-adresse.data.gouv.fr/search/?limit=5&q=${encodeURIComponent(r.q)}${r.postcode ? `&postcode=${r.postcode}` : ''}`, { credentials: 'omit' });
      if (!rep.ok) throw new Error('ban ' + rep.status);
      const j = jugerBan(await rep.json(), r.attendu || { cp: p.cp });
      // Un résultat sûr, ou « plusieurs endroits » : on s'arrête (la requête
      // suivante, plus large, ne lèverait pas une ambiguïté).
      if (j.lat != null || j.echec === 'ambigu') { res = j; break; }
      if (!res) res = j;
    }
  } catch (_) { return 'reseau'; }
  const sur = res && res.lat != null;
  const c2 = lireCache(); c2[k] = sur ? { lat: res.lat, lon: res.lon, villeLue: res.ville || '', cpLu: res.cp || '' } : { echec: Date.now(), raison: (res && res.echec) || 'introuvable' }; ecrireCache(c2);
  return sur ? { lat: res.lat, lon: res.lon } : { echec: (res && res.echec) || 'introuvable' };
}

// Les repères des points (cle → {lat,lon} | {echec} | 'reseau'), cherchés quand `actif`.
// (1er nov.) Ce qui est déjà en cache est rendu TOUT DE SUITE et ne compte pas
// dans le budget (avant : 25 « recherches », cache compris, puis plus rien) ; un
// effet relancé (une lecture qui arrive) reprend où le précédent s'est arrêté.
const BUDGET_RESEAU = 40;
export function useReperes(groupes, actif) {
  const [reperes, setReperes] = React.useState({});
  const cle = groupes.map((g) => g.cle + '=' + (g.geocode || '')).join('|');
  React.useEffect(() => {
    if (!actif) return undefined;
    let vivant = true;
    const deja = {};
    for (const g of groupes) {
      if (g.repere || !g.geocode) continue;
      const c = repereEnCache(g);
      if (c !== undefined) deja[g.cle] = c;
    }
    if (Object.keys(deja).length) setReperes((r) => ({ ...r, ...deja }));
    (async () => {
      let n = 0;
      for (const g of groupes) {
        if (!vivant || n >= BUDGET_RESEAU) break;
        if (g.repere || !g.geocode || deja[g.cle] !== undefined) continue;
        n++;
        const hit = await chercherRepere(g);
        if (!vivant) return;
        setReperes((r) => ({ ...r, [g.cle]: hit }));
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle]);
  return reperes;
}
export const repereDe = (g, reperes) => (g.repere ? g.repere : (reperes[g.cle] && reperes[g.cle].lat != null ? reperes[g.cle] : null));

// LA raison, en français simple, pour laquelle un point n'est pas sur la carte
// (la même phrase dans Colis et dans la tournée) ; '' s'il y est.
export const EN_COURS = 'localisation en cours…';
// Le code machine de cette raison (pour les bancs, `data-*`) : '' sur la carte.
export function codePasSurCarte(p, reperes) {
  if (!p || p.inconnu) return 'inconnu';
  if (repereDe(p, reperes)) return '';
  if (p.sansCarte) return p.sansCarteCode || 'adresse';
  const r = reperes[p.cle];
  if (r === undefined) return p.geocode ? 'cherche' : 'adresse';
  if (r === 'reseau') return 'reseau';
  return (r && r.echec) || 'introuvable';
}
export function raisonPasSurCarte(p, reperes) {
  if (!p || p.inconnu) return 'le point de retrait n’est pas encore connu';
  if (repereDe(p, reperes)) return '';
  if (p.sansCarte) return p.sansCarte;
  const r = reperes[p.cle];
  if (r === undefined) return p.geocode ? EN_COURS : 'le message ne donne pas une adresse complète';
  if (r === 'reseau') return 'la carte des adresses n’a pas répondu, réessai à la prochaine ouverture';
  const base = RAISONS_BAN[(r && r.echec) || 'introuvable'] || RAISONS_BAN.introuvable;
  return p.vintedPlusieurs ? `${base} (et la liste de Vinted donne plusieurs positions pour ce nom)` : base;
}

// Les épingles : UNE par point relais, qui porte le NOMBRE de colis
// (`nombreEpingle`). Deux points au même endroit (un casier dans un commerce) :
// deux épingles côte à côte, jamais l'une cachée sous l'autre.
function decalages(points) {
  const parPos = new Map();
  return points.map((p) => {
    const k = `${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`;
    const i = parPos.get(k) || 0; parPos.set(k, i + 1);
    return i;
  });
}

const jourFr = (s) => { const t = Date.parse(String(s || '') + 'T12:00:00'); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; };

// UNE épingle par point relais (1er nov.), qui porte le NOMBRE de colis
// (`nombreEpingle` — la ligne du point dit le même) ; `etiquette(p)` ne sert
// qu'à l'ancien bloc « Par point relais » (arrivés + attendus). Toucher une
// épingle appelle `onChoisir(cle)` ; l'épingle choisie est entourée.
// (8 nov.) `cooperatif` (au doigt) : un doigt fait défiler la PAGE, deux doigts déplacent la carte
// (`cooperativeGestures` de MapLibre, phrase en français) — la carte ne prend jamais le défilement.
const PHRASES_GESTES = { 'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer la carte', 'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer la carte', 'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour déplacer la carte' };
// (9 nov., Julien : capture iPhone, « Deux doigts pour déplacer la carte » écrit EN TRAVERS de la carte)
// MapLibre pose ce voile à chaque glissement d'un doigt sur la carte — donc à chaque défilement de la
// page qui passe dessus. Le voile est éteint (styles-colis-colonnes.css) ; à sa place, UN indice bref,
// dans un coin, la première fois que la carte s'affiche au doigt pendant cette visite, qui s'efface seul.
// La carte ne prend toujours pas le glissement d'un doigt (`cooperativeGestures`) : la page défile.
export const INDICE_GESTES = 'Deux doigts pour déplacer la carte';
export const INDICE_MS = 2500;
let INDICE_MONTRE = false;
// Le transporteur LU commun à tous les colis COMPTÉS d'un point (sa clé), ou null (aucun, ou plusieurs).
export function transporteurDuPoint(p) {
  const cles = new Set();
  for (const c of (p && p.arrives) || []) { if (c && c.horsCompte) continue; const k = c && c.transp && c.transp.cle; cles.add(k || ''); }
  if (cles.size !== 1) return null;
  const k = [...cles][0];
  return k || null;
}
const margesCadre = (h) => (h < 240 ? { top: 42, bottom: 58, left: 28, right: 28 } : { top: 48, bottom: 64, left: 40, right: 40 });
export function FondRelais({ points, selection, onChoisir, C, etiquette, hauteur = 260, onEtat, muet = false, cooperatif = false }) {
  const boite = React.useRef(null);
  const carteRef = React.useRef(null);
  const elements = React.useRef(new Map());
  const [etat, setEtat] = React.useState('charge');
  React.useEffect(() => { if (onEtat) onEtat(etat); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [etat]);
  const texte = (p) => String(etiquette ? etiquette(p) : nombreEpingle(p).n);
  const cle = points.map((p) => `${p.cle}:${p.lat}:${p.lon}:${texte(p)}:${nombreEpingle(p).sorte}:${transporteurDuPoint(p) || ''}`).join('|');
  React.useEffect(() => {
    let vivant = true, carte = null; const marqueurs = [];
    // (1er nov.) Une carte refaite (un repère arrivé) repart de « charge » : un
    // échec passé ne la cache plus, et elle se cadre sur une boîte À SA TAILLE
    // (avant, une boîte masquée par un échec donnait un cadrage faux).
    setEtat('charge');
    elements.current = new Map();
    const dec = decalages(points);
    import('./fondCarte.js').then((f) => {
      if (!f.webglDispo()) throw new Error('webgl');
      return f.chargerMaplibre().then((ml) => {
        if (!vivant || !boite.current) return;
        const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2], zoom: 12, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, ...(cooperatif ? { cooperativeGestures: true, locale: PHRASES_GESTES } : {}) });
        carteRef.current = carte;
        carte.once('load', () => {
          try { carte.resize(); } catch (_) {}
          if (points.length > 1) carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: margesCadre(hauteur), maxZoom: 15, duration: 0 });
          else carte.setZoom(14);
          points.forEach((p, i) => {
            const ep = nombreEpingle(p);
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'vrm-relais-epingle';
            el.setAttribute('data-relais-epingle', p.cle);
            el.setAttribute('data-relais-n', texte(p));
            el.setAttribute('data-relais-sorte', ep.sorte);
            const quoi = ep.sorte === 'aretirer' ? 'à retirer' : ep.sorte === 'averifier' ? 'à vérifier' : 'en route';
            el.setAttribute('aria-label', `${p.nom || p.adresseCourte || 'Point relais'} : ${ep.n} colis ${quoi}`);
            // (9 nov. au soir, « la carte des points relais doit être parfaite ») La MARQUE du transporteur sur
            // l'épingle, quand tous les colis comptés du point ont le même transporteur LU ; sinon le nombre seul.
            const tP = transporteurDuPoint(p);
            if (tP) {
              el.setAttribute('data-relais-epingle-transp', tP);
              el.innerHTML = svgMarque(tP, 20) + '<span data-relais-epingle-n=""></span>';
              el.lastChild.textContent = texte(p);
            } else el.textContent = texte(p);
            // Une seule couleur d'accent, rare (§7) : l'épingle d'un point où des
            // colis ATTENDENT d'être retirés ; les autres restent neutres.
            const fort = ep.sorte === 'aretirer';
            el.style.cssText = `min-width:34px;height:34px;padding:0 ${tP ? '9px 0 5px' : '8px'};border-radius:17px;border:2px solid #fff;font:700 14px/30px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);color:${fort ? '#fff' : '#1d2430'};background:${fort ? (C.accent || '#2f5bd3') : '#fff'};display:flex;align-items:center;gap:5px;box-sizing:border-box`;
            if (fort) el.setAttribute('data-relais-arrives', '');
            el.addEventListener('click', (e) => { e.stopPropagation(); onChoisir && onChoisir(p.cle); });
            elements.current.set(p.cle, el);
            // Deux points au même endroit : côte à côte (38 px), jamais superposés.
            // `subpixelPositioning` : l'épingle suit le fond au sous-pixel près (sans lui,
            // MapLibre l'arrondit au pixel quand la carte se pose : un saut de 0,5 px).
            const k = dec[i];
            marqueurs.push(new ml.Marker({ element: el, anchor: 'bottom', subpixelPositioning: true, offset: [k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 38 : 0, 0] }).setLngLat([p.lon, p.lat]).addTo(carte));
          });
          marquerChoisi(elements.current, selection);
          f.poserFond(carte, { sombre: false, annule: () => !vivant }).then(() => { if (vivant) setEtat('pret'); }).catch(() => { if (vivant) setEtat('ko'); });
        });
      });
    }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; carteRef.current = null; for (const m of marqueurs) { try { m.remove(); } catch (_) {} } if (carte) carte.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, cooperatif]);
  React.useEffect(() => { marquerChoisi(elements.current, selection); }, [selection]);
  const [indice, setIndice] = React.useState(false);
  React.useEffect(() => {
    if (!cooperatif || etat !== 'pret' || INDICE_MONTRE) return undefined;
    INDICE_MONTRE = true; setIndice(true);
    const t = setTimeout(() => setIndice(false), INDICE_MS);
    return () => clearTimeout(t);
  }, [cooperatif, etat]);
  // (8 nov.) « Agrandir » / « Réduire » : la boîte change de hauteur, la carte se recadre sur les mêmes points.
  const premiereHauteur = React.useRef(true);
  React.useEffect(() => {
    if (premiereHauteur.current) { premiereHauteur.current = false; return; }
    const carte = carteRef.current; if (!carte || !points.length) return;
    try {
      carte.resize();
      const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
      if (points.length > 1) carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: margesCadre(hauteur), maxZoom: 15, duration: 0 });
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hauteur]);
  const ko = etat === 'ko';
  return (
    <div style={{ position: 'relative' }}>
      <div ref={boite} data-relais-fond={etat} data-relais-cadre={points.length ? [Math.min(...points.map((p) => p.lon)), Math.min(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lon)), Math.max(...points.map((p) => p.lat))].map((v) => Number(v).toFixed(3)).join(',') : ''} className="vrm-relais-fond" aria-hidden={ko ? 'true' : undefined}
        style={{ width: '100%', height: hauteur, borderRadius: 10, overflow: 'hidden', background: '#eaeef2', ...(ko ? { position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' } : null) }}/>
      {indice && !ko ? <span className="vrm-relais-indice" data-carte-indice="" role="status">{INDICE_GESTES}</span> : null}
      {ko && !muet && <div data-relais-carte-ko="" style={{ fontSize: 12, color: 'var(--vrm-muted, #667)', padding: '8px 0' }}>La carte ne s’affiche pas ici pour l’instant — la liste ci-dessous reste juste.</div>}
      {selection ? <span className="vrm-sr">{selection}</span> : null}
    </div>
  );
}
function marquerChoisi(els, selection) {
  for (const [k, el] of els) {
    const oui = !!selection && k === selection;
    if (oui) el.setAttribute('data-relais-choisi', ''); else el.removeAttribute('data-relais-choisi');
    el.style.outline = oui ? '3px solid #1d2430' : '';
    el.style.outlineOffset = oui ? '2px' : '';
    el.style.zIndex = oui ? '2' : '';
  }
}

// ── « À RETIRER », PAR POINT (1er nov. ; refait le 2 nov., « on ne comprend rien ») ──
// Julien, au téléphone : « des colis dans tous les sens avec des codes de retrait
// partout ». Chaque colis à retirer est écrit UNE fois, ici, sous SON point
// (la règle `pointsARetirer` ne change pas) : ce que c'est, SON code une fois
// (nommé, copiable — rendu par `gestes`, qui vient de l'écran Colis avec le QR,
// « Suivre » et « J'ai retiré »). Les colis « à vérifier » (`horsCompte`) restent
// VISIBLES (§5 : un colis caché est un colis perdu), dans un groupe à part en bas,
// leur raison dite une fois en tête quand elle est commune. Au téléphone la carte
// n'est pas dessinée (`avecCarte` faux) : aucune phrase sur la carte dans la liste.
const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const texteLimite = (j) => (j == null ? '' : j < 0 ? 'date limite passée' : j === 0 ? 'dernier jour aujourd’hui' : j === 1 ? 'dernier jour demain' : `encore ${j} jours`);

function CarteColisRetirer({ x, Photo, gestes, detail, limiteSurCarte, avecLieu = false, raison = '', C = null, avecTransporteur = false }) {
  const ph = x.photo && Photo ? Photo(x.photo) : null;
  // Avec `detail` (l'écran Colis), la date limite exacte de CE colis y est dite.
  const surCarte = limiteSurCarte && !detail;
  const sousTitre = [avecLieu ? (x.lieuNom || '') : '', raison, surCarte && x.jours != null ? texteLimite(x.jours) : ''].filter(Boolean);
  const codeTxt = x.code ? x.code : x.qr ? 'QR code' : '';
  const attrs = { 'data-cc-carte': x.cle, 'data-cible': cibleRetrait(x.cle), 'data-cc-dans': x.redirige ? 'route' : 'retirer', 'data-rp-redirige': x.redirige ? '1' : undefined, 'data-rp-code-de': x.redirige ? (x.codeDe || '') : undefined, 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined, 'data-hors-compte': x.horsCompte ? '1' : undefined, 'data-sans-lieu': x.sansLieu ? '1' : undefined, 'data-colis-ident': x.cle, 'data-en-verification-tx': String(x.cle || '').startsWith('r:c:') ? String(x.cle).slice(4) : undefined,
    'data-a-verifier-raison': x.horsCompte && x.raisonCode ? x.raisonCode : undefined, 'data-a-verifier-code': x.horsCompte ? (x.encoreCode || x.code || x.qr ? 'oui' : 'non') : undefined,
    // (2 nov.) Le transporteur LU de CE colis (src/transporteursVisuels.js) : la clé des statistiques.
    'data-transporteur': x.transp ? cleStatTransporteur(x.transp) : undefined };
  return (
    <div className="vrm-cc-carte vrm-rp-carte" {...attrs}>
      <span className="vrm-cc-haut">
        {ph
          ? <span className="vrm-cc-photo" aria-hidden="true">{ph}</span>
          : <span className="vrm-cc-photo is-sans" data-sans-photo="" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg></span>}
        <span className="vrm-rp-quoi">
          <span className="vrm-cc-nom" title={x.titre}>{x.titre}</span>
          {sousTitre.length ? <span className={'vrm-rp-sous' + (surCarte && x.jours != null && x.jours <= 1 ? ' is-ambre' : '')} data-rp-sous="">{sousTitre.join(' · ')}</span> : null}
          {avecTransporteur && x.transp ? <span className="vrm-rp-transp"><PastilleTransporteur t={x.transp} C={C} seul taille={18}/></span> : null}
          {detail ? detail(x) : null}
        </span>
        {x.num ? <span className="vrm-cc-num" data-numero={x.num}>N°{x.num}</span> : null}
      </span>
      {x.sansLieu && !x.horsCompte ? <span className="vrm-rp-raison" data-sans-lieu-raison=""><span>{x.sansLieu.raison}</span> <span className="vrm-rp-geste">{x.sansLieu.geste}</span></span> : null}
      {gestes
        ? <span className="vrm-rp-gestes" data-code-retrait={x.code || ''}>{gestes(x)}</span>
        : <span className="vrm-rp-code-ligne">
            {codeTxt ? <span className="vrm-rp-code" data-code-retrait={x.code || ''}>{codeTxt}{x.code2 ? <span className="vrm-rp-code2"> · {x.code2}</span> : null}</span> : <span className="vrm-rp-sans-code">code pas encore lu</span>}
          </span>}
    </div>
  );
}

// ── (3 nov., Julien : « beaucoup trop brouillon ») « À RETIRER » AU STYLE DE « À ENVOYER » ──────────
// Une carte par point (nom + adresse sur une ligne, la puce du transporteur quand elle est LUE et
// commune, le nombre) ; dedans UNE ligne par colis : vignette (la photo de l'achat, par identité, sinon
// une tuile neutre), titre, l'échéance en une puce, « Code » s'il est connu, « J'ai retiré ». Tout le
// reste (n° de suivi, compte, transporteur, nouvelles, Conversation, Suivre) s'ouvre en touchant la
// ligne (`detail` + `gestes`, les mêmes qu'avant). « Lieu à confirmer » en carte grise à la fin ;
// « À vérifier · N » replié, le statut en une puce. Aucune phrase. Mêmes listes, mêmes data-*.
// (8 nov., Julien : « une barre d'évolution avec le délai pour retirer ») UNE BARRE FINE : le temps écoulé
// entre l'arrivée au point (LUE) et la date limite (LUE, sinon la garde du transporteur, « estimée »), et ce
// qui reste en mots. Neutre ; AMBRE dans les dernières 24 h et au-delà (un geste à faire, §7) ; jamais
// rouge. Sans date d'arrivée : pas de barre (la puce d'échéance reste). Règle : src/delaiRetrait.js.
// (12 nov., finitions) « vérifié par e-mail hier 11:19 » ⇒ « e-mail, hier 11:19 » dans la fiche (l'étiquette dit déjà
// « Vérifié »). Après des sources déjà nommées : « · hier 11:19 ».
const verifieCourt = (t, apresSources = false) => {
  const s = String(t || '').replace(/^vérifié\s*/, '');
  const m = /^par (.+?) ((?:à|hier|le) .*)$/.exec(s);
  if (m) return `${m[1]}, ${m[2]}`;
  return apresSources ? s : s.replace(/^à /, 'à ');
};
// (12 nov., finitions — Julien) L'ORTHOGRAPHE OFFICIELLE DES ENSEIGNES connues (casse, accents, point) : « INTERMARCHE »,
// « Intermarche » ⇒ « Intermarché ». Ce n'est pas deviner un lieu : seul le NOM de l'enseigne en tête est réécrit,
// le reste du nom lu est gardé tel quel.
const ENSEIGNES = [
  ['intermarche', 'Intermarché'], ['carrefour market', 'Carrefour Market'], ['carrefour city', 'Carrefour City'], ['carrefour express', 'Carrefour Express'],
  ['carrefour contact', 'Carrefour Contact'], ['carrefour', 'Carrefour'], ['e.leclerc', 'E.Leclerc'], ['e. leclerc', 'E.Leclerc'], ['e leclerc', 'E.Leclerc'], ['leclerc', 'E.Leclerc'],
  ['super u', 'Super U'], ['hyper u', 'Hyper U'], ['u express', 'U Express'], ['casino', 'Casino'], ['monoprix', 'Monoprix'], ['franprix', 'Franprix'],
  ['auchan', 'Auchan'], ['bureau vallee', 'Bureau Vallée'], ['relay', 'Relay'], ['maison de la presse', 'Maison de la Presse'], ['tabac presse', 'Tabac Presse'],
  ['lidl', 'Lidl'], ['aldi', 'Aldi'], ['netto', 'Netto'], ['spar', 'Spar'], ['vival', 'Vival'], ['proxi', 'Proxi'], ['cocci market', 'Cocci Market'],
];
const sansAccentsEns = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function nomEnseigne(nom) {
  const n = String(nom || '').trim(); if (!n) return n;
  const b = sansAccentsEns(n);
  for (const [k, v] of ENSEIGNES) if (b === k || b.startsWith(k + ' ') || b.startsWith(k + ',') || b.startsWith(k + '-')) return v + n.slice(k.length);
  return n;
}
export function BarreDelai({ d, enTete = false }) {
  if (!d) return null;
  return (
    <span className={'vrm-rpf-delai' + (d.ambre ? ' is-ambre' : '') + (enTete ? ' is-tete' : '')} data-rp-delai={d.code} data-rp-delai-pct={d.pct} data-rp-delai-ambre={d.ambre ? '1' : '0'} data-rp-delai-estimee={d.estimee ? '1' : undefined} data-rp-delai-tete={enTete ? '1' : undefined}>
      <span className="vrm-rpf-delai-piste" role="progressbar" aria-label="Délai pour retirer" aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.pct} aria-valuetext={d.valeurTexte}>
        <span className="vrm-rpf-delai-plein" style={{ width: `${d.pct}%` }}/>
      </span>
      <span className={'vrm-rpf-delai-txt' + (d.ambre ? ' is-ambre' : '')} data-rp-echeance={d.code} aria-hidden="true">{d.texte}{d.estimee ? <span className="vrm-rpf-delai-est"> · estimée</span> : null}</span>
    </span>
  );
}
function LigneRetraitF({ x, Photo, gestes, detail, echeance, statut, retirer, C = null, avecTransp = false, titreDe = null, delai = null, delaiEnTete = false, suiviDe = null, qrDe = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  const ouvrirFicheRef = React.useRef(() => setOuvert(true));
  const detailId = React.useId();
  const [copie,setCopie]=React.useState(false);
  const copieGen=React.useRef(0);
  React.useEffect(()=>{copieGen.current++;setCopie(false);return()=>{copieGen.current++;};},[x.cle,x.code]);
  const voirCode=async()=>{try{ouvrirFicheRef.current();}catch(_){}if(!x.code)return;const gen=copieGen.current;try{await navigator.clipboard.writeText(String(x.code));if(gen===copieGen.current)setCopie(true);}catch(_){if(gen===copieGen.current)setCopie(false);}};
  const ph = x.photo && Photo ? Photo(x.photo) : null;
  // La barre dit l'échéance (§7 : jamais deux fois) ; sans barre, la puce d'échéance reste.
  // (12 nov., finitions — Julien : « rien n'est cohérent ») UNE FORME DE LIGNE, la même pour chaque colis :
  // vignette (photo de l'article relié, sinon le logo du transporteur) avec le logo TOUJOURS au coin ;
  // 1 · le nom de l'article (relié par identité) ou « Colis {transporteur} » — jamais le n° de suivi ;
  // 2 · le code en gros, ou « Code à venir », à la même place ; 3 · le n° de suivi discret, ou rien ;
  // 4 · la barre du délai TOUJOURS : « encore N j », « · estimée », ou « Date limite inconnue » (barre vide).
  // Seul l'AFFICHAGE change : les mêmes sources, les mêmes règles (`delai`, `echeance`, `titreDe`, `suiviDe`).
  const dl0 = !x.horsCompte && delai ? delai(x) : null;
  const e0 = dl0 ? null : (echeance ? echeance(x) : null);
  const dl = dl0 || (e0 ? { code: e0.code || 'date', pct: 0, ambre: !!e0.ambre, texte: e0.t, valeurTexte: e0.t } : { code: 'inconnue', pct: 0, ambre: false, texte: 'Date limite inconnue', valeurTexte: 'Date limite inconnue' });
  const e = null;
  const st = statut ? statut(x) : null;
  // (10 nov., retraits irréprochables) Deux sources donnent deux codes différents : rien n'est choisi,
  // la ligne le dit en ambre et le détail montre les deux valeurs avec leur source (src/sourcesRetrait.js).
  const desaccord = Array.isArray(x.codesDesaccord) && x.codesDesaccord.length > 1 ? x.codesDesaccord : null;
  const aCode = !!(x.code || x.qr || x.code2 || desaccord);
  // (11 nov.) La source qui a vérifié en dernier est dite dans « vérifié par … » : pas deux fois.
  const parSource = x.verifiePar ? (['email', 'sms', 'vinted', 'message'].includes(x.verifiePar) ? x.verifiePar : 'transporteur') : '';
  const marques = Array.isArray(x.sources) ? x.sources : [];
  const marquesVues = marques.filter((m) => !(parSource && m === parSource && !texteVerifie(x.verifieMs, Date.now(), x.verifiePar).startsWith('pas')));
  const verifie = texteVerifie(x.verifieMs, Date.now(), x.verifiePar);
  const ancien = !x.horsCompte && verifieAncien(x.verifieMs);
  const attrs = { 'data-cc-carte': x.cle, 'data-cible': cibleRetrait(x.cle), 'data-cc-dans': x.redirige ? 'route' : 'retirer', 'data-rp-redirige': x.redirige ? '1' : undefined, 'data-rp-code-de': x.redirige ? (x.codeDe || '') : undefined, 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined, 'data-hors-compte': x.horsCompte ? '1' : undefined, 'data-sans-lieu': x.sansLieu ? '1' : undefined, 'data-colis-ident': x.cle, 'data-en-verification-tx': String(x.cle || '').startsWith('r:c:') ? String(x.cle).slice(4) : undefined,
    'data-a-verifier-raison': x.horsCompte && x.raisonCode ? x.raisonCode : undefined, 'data-a-verifier-code': x.horsCompte ? (x.encoreCode || x.code || x.qr ? 'oui' : 'non') : undefined,
    'data-transporteur': x.transp ? cleStatTransporteur(x.transp) : undefined, 'data-ordre-t': x.arrivee != null ? String(x.arrivee) : '',  // (lot AJ) l'arrivée lue qui range la ligne
    'data-rp-sources': marques.join(','), 'data-rp-verifie': Number.isFinite(x.verifieMs) ? String(x.verifieMs) : '', 'data-rp-code-sur': x.code && x.codeSur ? '1' : undefined, 'data-rp-codes-desaccord': desaccord ? desaccord.map((d) => d.source + ':' + d.code).join(',') : undefined };
  const suLigne = suiviDe ? String(suiviDe(x) || '') : '';
  const titreLigne = (titreDe && titreDe(x)) || x.titre || '';
  // (14 nov., proposition 62) Toucher le colis ouvre LA fiche de la paire (le N° relié à CE colis par identité :
  // son n° de commande, son suivi) ; le code, ses sources et les gestes (Retiré, QR…) y sont rendus en haut.
  // Un colis sans paire reliée : la fiche du colis seul (« pas de paire reliée »), jamais une paire devinée.
  const fl = attrsFicheLigne({ contexte: 'retrait', site: x.site || 'vinted', cle: 'r' + x.cle, nums: x.num ? [String(x.num)] : [], suivi: suLigne, titre: titreLigne, sous: x.code ? String(x.code) : '' });
  const ouvrirFiche = () => { if (fl['data-fiche-ligne']) ouvrirLigne({ cle: fl['data-fiche-ligne'], contexte: 'retrait', site: x.site || 'vinted', nums: x.num ? [String(x.num)] : [], suivi: suLigne, titre: titreLigne, sous: x.code ? String(x.code) : '' }); else setOuvert((o) => !o); };
  const basculer = ouvrirFiche;
  ouvrirFicheRef.current = ouvrirFiche;
  const titreSansArticle = !titreLigne || /^n°/i.test(titreLigne) || /^colis\b/i.test(titreLigne);
  const nomTransp = x.transp && !x.trInconnu ? String(x.transp.nom || '') : '';
  // Au point relais, un colis Chronopost est un colis « Chronopost Pickup » (le nom du réseau de points).
  const nomAffiche = nomTransp ? (x.transp.cle === 'chronopost' ? 'Chronopost Pickup' : nomTransp) : '';
  const titreAffiche = titreSansArticle ? (nomAffiche ? `Colis ${nomAffiche}` : 'Colis') : titreLigne;
  // Ligne 3 : le nom du transporteur EN CLAIR quand le titre est l'article (sinon le titre le dit déjà), puis le n°.
  const ligne3 = [titreSansArticle ? '' : nomAffiche, suLigne ? `n° ${suLigne}` : ''].filter(Boolean).join(' · ');
  const ouvrirQr = qrDe ? qrDe(x) : null;
  // (12 nov., finitions — règle 3 de Julien) Arrivé SANS code : on dit OÙ il est, jamais « à venir » comme si c'était
  // normal. Un achat Vinted (sa page, ou l'e-mail « Ton achat t'attend ») : le code est sur Vinted ; un colis du
  // transporteur : son code arrive dans l'e-mail du transporteur. La phrase entière est dans le dépli.
  const tSrc = (x.src && x.src.t) || null;
  const codeSurVinted = !tSrc || tSrc.source === 'vinted-commande';
  const sansCodeCourt = codeSurVinted ? 'Code sur Vinted' : x.horsCompte ? 'Code pas lu' : 'Code pas encore reçu';
  // (12 nov., finitions) Le serveur vérifie CE colis chez son transporteur (« retiré » puis « changé de plan »,
  // `aVerifierTransporteur`, api/_lib/suivi-colis.js) : rien à faire pour le vendeur ⇒ une mention NEUTRE à la
  // place du délai (jamais une question, jamais ambre), même place, même hauteur.
  const verifT = !!(x.src && x.src.t && x.src.t.aVerifierTransporteur);
  // (13 nov.) Un colis REDIRIGÉ, encore en route : une mention neutre (rien à faire), à la place du délai.
  const dl4 = x.redirige ? { code: 'point-change', pct: 0, ambre: false, texte: 'En route · point changé', valeurTexte: 'En route vers un nouveau point relais' } : verifT ? { code: 'verif-transporteur', pct: 0, ambre: false, texte: 'Vérification en cours', valeurTexte: `Vérification chez ${nomAffiche || 'le transporteur'} en cours` } : dl;
  // (11 nov., gestes-glisser) Glisser vers la gauche : « Retiré » (principale, le glisser long : `retirer`,
  // le geste annulable 5 s) et « Le code » (le MÊME geste que le bouton « Code » : la ligne s'ouvre, le code
  // est copié ; deux codes en désaccord ⇒ la ligne s'ouvre, rien n'est choisi).
  const actionsG = [
    retirer ? { cle: 'retire', libelle: 'Retiré', icone: <IcoCoche/>, faire: () => retirer(x), data: { 'data-lg-retire': x.cle } } : null,
    aCode ? { cle: 'code', libelle: desaccord ? '2 codes' : 'Le code', icone: <IcoCode/>, faire: () => (desaccord ? setOuvert(true) : voirCode()), data: { 'data-lg-code': x.cle } } : null,
  ];
  return (
    <LigneGlissable actions={actionsG} cle={x.cle} libelle={x.titre || 'colis'}>{(gp, tiroirG) => (
    <div className="vrm-rpf-ligne" {...attrs} {...gp} {...fl} data-ouvert={ouvert ? '1' : undefined}>
      {/* Le code de CE colis, lisible par les autres écrans et les bancs (`data-code-retrait`) ; affiché au toucher. */}
      {x.code ? <span hidden data-code-retrait={x.code}/> : null}
      <div className="vrm-rpf-rang">
        <button type="button" className="vrm-rpf-ouvrir" aria-expanded={ouvert} aria-controls={detailId} onClick={basculer}>
        <span className={'vrm-rpf-vignette' + (ph ? '' : ' is-sans')} aria-hidden="true" data-sans-photo={ph ? undefined : ''}>
          {ph || (x.transp && x.transp.cle && !x.trInconnu ? <span className="vrm-rpf-vignette-logo" data-rp-vignette-logo={x.transp.cle}><PastilleTransporteur t={x.transp} C={C} seul taille={32}/></span>
            : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>)}
          {/* Le logo du transporteur au coin de la PHOTO ; sans photo, la vignette EST le logo (jamais deux fois). */}
          {ph || !(x.transp && x.transp.cle && !x.trInconnu) ? <BadgeTransporteur t={x.trInconnu ? null : x.transp}/> : null}
        </span>
        <span className="vrm-rpf-quoi">
          {/* (11 nov.) Un colis sans titre d'article s'appelait « n°…0010 » juste au-dessus de « n° 81000010 » : le même
              n° deux fois. Son titre EST son n° de suivi complet (la clé), et la ligne du code ne le redit pas. */}
          <span className="vrm-rpf-titre" title={titreAffiche} data-rp-titre="" data-rp-titre-article={titreSansArticle ? undefined : ''}>{x.num ? `N°${x.num} · ` : ''}{titreAffiche}</span>
          {/* (11 nov., Julien : « des QR codes, des infos dans tous les sens, on ne comprend rien » ; « le n° de suivi
              est une clé ») CE QU'IL FAUT AU COMPTOIR, sans toucher : le code (gros), le n° de suivi, l'échéance.
              Plus de ligne de sources (« Vinted · e-mail · message · vérifié à… ») : elles restent en data-*. */}
          <span className="vrm-rpf-comptoir" data-rp-comptoir="">
            {desaccord ? <span className="vrm-rpf-code-gros is-ambre" data-rp-code-visible="desaccord" data-rp-code-desaccord="">2 codes</span>
              : x.code ? <span className="vrm-rpf-code-gros" data-rp-code-visible={x.code}>{x.code}{x.code2 ? <span className="vrm-rpf-code2"> · {x.code2}</span> : null}</span>
              : (x.qr ? <span className="vrm-rpf-code-gros is-qr" data-rp-code-visible="qr">QR</span>
              : <span className="vrm-rpf-code-venir" data-rp-code-a-venir="" data-rp-code-ou={codeSurVinted ? 'vinted' : 'email'}>{sansCodeCourt}</span>)}
            {/* Le QR : une petite icône à côté du code, au doigt ⇒ le QR en grand (le reste de la ligne ouvre la fiche). */}
            {ouvrirQr ? <span className="vrm-rpf-qr-mini" data-rp-qr-ligne="" role="img" aria-label="QR de retrait : touche pour l’afficher en grand" title="QR en grand" onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); ouvrirQr(); }}><IcoCode/></span> : null}
          </span>
          {ligne3 ? <span className="vrm-rpf-suivi-ligne" data-rp-suivi-ligne={suLigne || undefined} data-rp-sans-suivi={suLigne ? undefined : ''} data-rp-transp-nom={titreSansArticle ? undefined : nomAffiche || undefined}>{ligne3}</span> : <span className="vrm-rpf-suivi-ligne is-vide" data-rp-sans-suivi="" aria-hidden="true">{'\u00a0'}</span>}
          <span className="vrm-rpf-ligne-delai" data-rp-l4="" data-rp-verif-transporteur={verifT ? '' : undefined}><BarreDelai d={dl4}/></span>
          {(st || e || x.lieuDeplace || ancien) ? <span className="vrm-rpf-puces">
            {st ? <span className="vrm-rpf-puce is-ambre" data-rp-statut="">{st}</span> : null}
            {x.lieuDeplace ? <span className="vrm-rpf-puce is-ambre" data-rp-deplace={x.lieuDeplace.carrier || ''}>{texteDeplace(x.lieuDeplace)}</span> : null}
            {e ? <span className={'vrm-rpf-puce' + (e.ambre ? ' is-ambre' : '')} data-rp-echeance={e.code || ''}>{e.t}</span> : null}
            {/* (11 nov., intégration) Les sources passent dans le détail (Julien) ; reste sur la ligne, en ambre, le seul
                geste qu'elles appellent : un colis que rien n'a reconfirmé depuis plus de 48 h (retraits fiables). */}
            {ancien ? <span className="vrm-rpf-puce is-ambre" data-rp-pas-confirme="1">{texteNonConfirme(x.verifieMs)}</span> : null}
          </span> : null}
        </span>
        <span className="vrm-rpf-chevron" aria-hidden="true">{ouvert ? '⌃' : '⌄'}</span>
        </button>
        {/* (11 nov.) Le code est écrit sur la ligne : plus de bouton « Code » (toucher la ligne ouvre le détail ;
            glisser à gauche le copie toujours). */}
        {retirer ? <button type="button" className="vrm-rpf-retire" data-colis-retire="" aria-label="J’ai retiré ce colis" onClick={(ev) => { ev.stopPropagation(); retirer(x); }}>J’ai retiré</button> : null}
      </div>
      {/* La barre hors du bouton de la ligne (un bouton rend ses enfants muets pour un lecteur d'écran). */}
      {fl['data-fiche-ligne'] || ouvert ? <DansFiche cle={fl['data-fiche-ligne']} place="contexte" seulementFiche={!ouvert}><div className="vrm-rpf-detail" id={detailId} data-rp-detail="">
        {desaccord ? <div className="vrm-rpf-desaccord" data-rp-desaccord="" role="note">
          <span className="vrm-rpf-desaccord-t">Deux codes différents — vérifie sur place</span>
          {desaccord.map((d) => <span key={d.source + d.code} className="vrm-rpf-desaccord-v" data-rp-desaccord-valeur={d.code} data-rp-desaccord-source={d.source}><b>{d.code}</b> · {NOMS_SOURCES[d.source] || d.source}</span>)}
        </div> : null}
        {detail ? <div className="vrm-rpf-detail-txt">{detail(x)}</div> : null}
        {/* (11 nov.) D'où vient ce que la ligne dit (les sources qui ont vu CE colis, l'heure de la dernière vérification) :
            dans le détail ouvert, plus sur la ligne (Julien : « des infos dans tous les sens »). */}
        {/* (12 nov., finitions) La dernière ligne de la fiche : « Vérifié · e-mail · par Mondial Relay à 14:26 », étiquetée comme les autres. */}
        {marquesVues.length || verifie ? <div className="vrm-rpf-fiche-l vrm-rpf-sources is-detail" data-rp-sources-ligne=""><span className="vrm-rpf-fiche-k">Vérifié</span><span className="vrm-rpf-fiche-v">{marquesVues.map((m) => <span key={m} className="vrm-rpf-source" data-rp-source={m}>{NOMS_SOURCES[m] || m}</span>)}{verifie ? <span className={'vrm-rpf-verifie' + (ancien ? ' is-ambre' : '')} data-rp-verifie-texte="">{verifieCourt(verifie, marquesVues.length > 0)}</span> : null}</span></div> : null}
        {gestes ? <div className="vrm-rp-gestes">{gestes(x)}</div> : null}
        {/* (14 nov., proposition 62) « J'ai retiré », le geste de la ligne, aussi dans la fiche (le même appel). */}
        {retirer && !ouvert ? <button type="button" className="vrm-rpf-retire" data-colis-retire="" data-fiche-retire="" onClick={(ev) => { ev.stopPropagation(); retirer(x); }}>J’ai retiré</button> : null}
      </div></DansFiche> : null}
      {tiroirG}
    </div>
    )}</LigneGlissable>
  );
}
const IcoCoche = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;
const IcoCode = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM20.5 14v3M17.5 20.5h3"/></svg>;
// (3 nov., Julien : « si il y a 2 villes sur la carte, je veux que l'on puisse sélectionner une ville »)
// (3 nov., 18 h 59 : « il ne reconnaît pas les villes ») LA RÈGLE est dans src/villeRelais.js : la ville
// LUE (avec ou sans code postal — les consignes Vinted Go n'en écrivent jamais), normalisée (casse,
// accents, tirets, « St », arrondissements) ; un code postal seul ⇒ la table officielle (Base Adresse)
// ou le géocodage sûr au même code postal ; plusieurs communes ⇒ le code postal seul. Ici : ses deux
// sources de ce navigateur (communes par code postal, ville des repères trouvés), les mêmes pour la
// carte sombre de Colis et pour le sélecteur (une seule réponse).
const CACHE_COMMUNES = 'vrm_cp_communes_v1';
const lireCommunes = () => { try { const c = JSON.parse(localStorage.getItem(CACHE_COMMUNES) || '{}') || {}; const o = {}; for (const [k, v] of Object.entries(c)) if (v && Array.isArray(v.noms)) o[k] = v.noms; return o; } catch (_) { return {}; } };
function villeDeLaCarte(p) {
  const reqs = requetesBan(p);
  if (!reqs.length) return '';
  const c = lireCache()[cleAdr(reqs[0].q)];
  return c && c.lat != null && c.villeLue && /^\d{5}$/.test(String(p.cp || '')) && c.cpLu === String(p.cp) ? c.villeLue : '';
}
const optionsVille = () => ({ communes: lireCommunes(), villeCarte: villeDeLaCarte });
export const villeDuPoint = (p) => villeDuPointRegle(p, optionsVille());
export const villesDesPoints = (vue) => villesDesPointsRegle(vue, optionsVille());
// (8 nov.) Le sélecteur de « À retirer » : les villes où un colis attend (urgence, puis nombre), puis « Autres ».
export const selecteurVilles = (vue) => selecteurVillesRegle(vue, optionsVille());
export const pointsSansVille = (vue) => pointsSansVilleRegle(vue, optionsVille());
// Les codes postaux SEULS (sans ville lue) des points : leurs communes sont demandées UNE fois à la
// Base Adresse (`type=municipality`, code postal exact) et gardées dans ce navigateur ; une panne de
// réseau n'est pas notée. Rend un compteur qui change quand une réponse arrive (re-rendu).
const COMMUNES_EN_COURS = new Map();
export function useCommunesCp(vue, actif) {
  const [tic, setTic] = React.useState(0);
  const cps = [...new Set(((vue && vue.points) || []).filter((p) => !p.inconnu).map((p) => { const v = villeDuPointRegle(p, {}); return v && v.source === 'cp' ? v.cp : ''; }).filter(Boolean))].sort();
  const cle = cps.join(',');
  React.useEffect(() => {
    if (!actif || !cps.length) return undefined;
    let vivant = true;
    (async () => {
      for (const cp of cps.slice(0, 10)) {
        if (!vivant) return;
        if (lireCommunes()[cp]) continue;
        try {
          if (!COMMUNES_EN_COURS.has(cp)) COMMUNES_EN_COURS.set(cp, fetch(`https://api-adresse.data.gouv.fr/search/?q=${cp}&type=municipality&postcode=${cp}&limit=${LIMITE_COMMUNES}`, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)).finally(() => COMMUNES_EN_COURS.delete(cp)));
          const j = await COMMUNES_EN_COURS.get(cp);
          const noms = communesDepuisBan(j, cp);
          if (noms && noms.length) { try { const c = JSON.parse(localStorage.getItem(CACHE_COMMUNES) || '{}') || {}; c[cp] = { noms, at: Date.now() }; localStorage.setItem(CACHE_COMMUNES, JSON.stringify(c)); } catch (_) {} if (vivant) setTic((t) => t + 1); }
        } catch (_) { /* réseau : rien n'est noté, on redemandera */ }
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle]);
  return tic;
}
// (3 nov., 13 h 02, Julien : « tu dois mieux SÉPARER, tout doit être parfait ») DES SECTIONS, dans cet ordre,
// chaque colis UNE fois (priorité : aujourd'hui > prêts > code à venir > lieu à confirmer > à vérifier) :
//   1. « À retirer aujourd'hui » — le dernier jour (`jours` ≤ 0), une section ambre discrète ;
//   2. « Prêts à retirer » — avec leur code (ou QR), par point relais ;
//   3. « Code à venir » — arrivés sans code, par point relais ;
//   4. « Lieu à confirmer » ; 5. « À vérifier » (replié) ; 6. « En route » (replié, à la fin).
// La carte (plan) est au-dessus du sélecteur de ville ; les sections suivent la ville choisie.
// Aucune règle neuve : les mêmes lignes (`pointsARetirer`), rangées.
export const SECTIONS_RETRAIT = ['aujourdhui', 'prets', 'avenir', 'lieu', 'verifier', 'double', 'route'];
export function sectionDuColis(x, point) {
  // (5 nov.) Une moitié Vinted peut-être déjà comptée par son transporteur : à part, jamais comptée.
  if (x.horsCompte && x.raisonCode === 'doute_meme_relais') return 'double';
  if (x.horsCompte) return 'verifier';
  if (Number.isFinite(x.jours) && x.jours <= 0) return 'aujourdhui';
  if (!point || point.inconnu) return 'lieu';
  // (10 nov.) Deux codes en désaccord : le colis est là et ses codes sont connus (dits tous les deux) — pas « à venir ».
  return (x.code || x.qr || x.code2 || (Array.isArray(x.codesDesaccord) && x.codesDesaccord.length > 1)) ? 'prets' : 'avenir';
}
// (8 nov.) Hors réseau MESURÉ (`navigator.onLine === false`) : pas de carte (ni fond, ni Base Adresse) ; la liste marche.
function useEnLigne() {
  const [l, setL] = React.useState(() => { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch (_) { return true; } });
  React.useEffect(() => {
    const on = () => setL(true), off = () => setL(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return l;
}
const mouvementReduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const auDoigt = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };
// (11 nov., retraits fiables) Le transporteur dit le colis ailleurs, plus récemment que l'e-mail : dit, daté.
const NOMS_RESEAU = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', colissimo: 'Colissimo', relaiscolis: 'Relais Colis', dpd: 'DPD', ups: 'UPS', gls: 'GLS' };
export const texteDeplace = (d) => { if (!d) return ''; const h = Number.isFinite(d.at) ? new Date(d.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : ''; return `déplacé · selon ${NOMS_RESEAU[d.carrier] || 'le transporteur'}${h ? ' à ' + h : ''}`; };
const PREF_ORDRE = 'vrm_retirer_ordre';
const PREF_MASQUES = 'vrm_retirer_points_masques';
function ColonneRetirerF({ vue: vueTout, C, Photo, gestes, detail, avecCarte: avecCarteVoulu, ordi = true, delai = null, echeance, statut, retirer, ville = '', onVille = null, titreDe = null, enRoute = [], suiviDe = null, qrDe = null, redirige = [] }) {
  const enLigne = useEnLigne();
  // (8 nov., Julien : « réaffiche la carte ») La carte est AUSSI au téléphone (en haut de la liste, ~200 px) ;
  // hors réseau, pas de carte.
  const avecCarte = !!avecCarteVoulu && enLigne;
  const tousConnus = ((vueTout && vueTout.points) || []).filter((p) => !p.inconnu);
  // (9 nov., Julien : « À retirer · 0 » et une carte à 18 points) LA CARTE NE MONTRE QUE CE QUE L'ONGLET
  // COMPTE (`surLaCarte`, src/relaisColis.js) : un point dont tous les colis sont « à vérifier », « peut-être
  // en double » ou « en route » n'y a pas d'épingle — ses colis restent dans leurs replis, jamais cachés.
  const aEpingler = tousConnus.filter(surLaCarte);
  const reperes = useReperes(aEpingler, avecCarte && aEpingler.length > 0);
  useCommunesCp(vueTout, true);
  const villes = selecteurVilles(vueTout);
  const vChoisie = villes.find((v) => v.cle === ville) || null;
  // Une ville choisie montre SES points ; un colis sans ville (lieu à confirmer, ou point sans ville
  // ni code postal lus) n'est JAMAIS caché par ce choix (§5 : un colis caché est un colis perdu).
  const sansVille = new Set(pointsSansVille(vueTout));
  const vue = vChoisie ? { ...vueTout, points: ((vueTout && vueTout.points) || []).filter((p) => vChoisie.points.includes(p.cle) || sansVille.has(p.cle)) } : vueTout;
  // (11 nov., retraits fiables — « personnalisable ») SES préférences d'affichage, dans CE navigateur :
  // l'ordre (« Date limite » : le point au colis le plus pressé d'abord ; « Récents » : l'ordre de l'appelant)
  // et les points qu'il MASQUE. Un point masqué n'est jamais un colis caché sans trace : une ligne dit
  // « N point(s) masqué(s) » et les rend d'un toucher ; un colis du dernier jour n'est jamais masqué.
  const [ordre, setOrdreEtat] = React.useState(() => { try { return localStorage.getItem(PREF_ORDRE) === 'limite' ? 'limite' : 'recent'; } catch (_) { return 'recent'; } });   // « Récents » par défaut (sa décision du 9 nov.)
  const setOrdre = (o) => { setOrdreEtat(o); try { localStorage.setItem(PREF_ORDRE, o); } catch (_) {} };
  const [masques, setMasquesEtat] = React.useState(() => { try { const v = JSON.parse(localStorage.getItem(PREF_MASQUES) || '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch (_) { return new Set(); } });
  const setMasques = (m) => { setMasquesEtat(m); try { localStorage.setItem(PREF_MASQUES, JSON.stringify([...m])); } catch (_) {} };
  const pointsTous = (vue && vue.points) || [];
  const pressant = (p) => (p.arrives || []).some((c) => !c.horsCompte && Number.isFinite(c.jours) && c.jours <= 0);
  const masquesIci = pointsTous.filter((p) => !p.inconnu && masques.has(p.cle) && !pressant(p));
  const triLimite = (a, b) => (a.inconnu ? 1 : 0) - (b.inconnu ? 1 : 0) || (Number.isFinite(a.triPoint) ? a.triPoint : 99) - (Number.isFinite(b.triPoint) ? b.triPoint : 99);
  const points = (ordre === 'limite' ? [...pointsTous].sort(triLimite) : pointsTous).filter((p) => !masquesIci.includes(p));
  const connus = points.filter((p) => !p.inconnu);
  const [choisi, setChoisi] = React.useState('');
  const [etatFond, setEtatFond] = React.useState('charge');
  const racine = React.useRef(null);
  // La carte suit la ville choisie : SES points seuls (le cadrage se fait sur eux).
  const surCarte = avecCarte ? connus.filter(surLaCarte).filter((p) => !vChoisie || vChoisie.points.includes(p.cle)).map((p) => { const r = repereDe(p, reperes); return r ? { ...p, lat: r.lat, lon: r.lon } : null; }).filter(Boolean) : [];
  const [grande, setGrande] = React.useState(false);
  const hauteurCarte = grande ? (ordi ? 420 : 380) : (ordi ? 220 : 200);
  const choisir = (cle) => {
    setChoisi(cle);
    const el = racine.current && [...racine.current.querySelectorAll('[data-relais-point]')].find((e) => e.getAttribute('data-relais-point') === cle);
    if (el) { try { el.scrollIntoView({ behavior: mouvementReduit() ? 'auto' : 'smooth', block: 'start' }); } catch (_) { el.scrollIntoView(); } }
  };
  const trConnu = (x) => !!(x.transp && !x.trInconnu && cleStatTransporteur(x.transp) !== 'pas-lu');
  const ligne = (x, parLigne = true, delaiEnTete = false) => <LigneRetraitF key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} echeance={echeance} statut={x.horsCompte ? statut : null} retirer={retirer} C={C} avecTransp={parLigne && trConnu(x)} titreDe={titreDe} delai={delai} delaiEnTete={delaiEnTete} suiviDe={suiviDe} qrDe={qrDe}/>;
  // Le rangement : chaque colis dans SA section, avec son point.
  const parSection = { aujourdhui: [], prets: [], avenir: [], lieu: [], verifier: [], double: [] };
  // (3 nov., 19 h) Une ville choisie : un point SANS ville (nom seul, homonyme) va sous « Lieu à
  // confirmer », avec son nom — jamais compté dans la ville, jamais caché.
  // (8 nov.) « Autres » choisi : ses points SONT ceux sans ville, montrés comme les autres.
  const aConfirmer = (x, p) => !!vChoisie && vChoisie.cle !== CLE_AUTRES && !p.inconnu && sansVille.has(p.cle) && !x.horsCompte && !(Number.isFinite(x.jours) && x.jours <= 0);
  // (5 nov., Julien : « ça me met 2 points de retrait alors que c'est le même ») UN POINT,
  // UNE CARTE : un point qui a un colis prêt ET un colis au code à venir était dessiné deux
  // fois (« Prêts à retirer » puis « Code à venir »). Le point va dans la section de son colis
  // le plus pressé, avec tous ses colis ; chaque ligne garde sa puce (« Code à venir »,
  // « dernier jour »). « Lieu à confirmer » et « À vérifier » ne bougent pas.
  const RANG_SECTION = { aujourdhui: 0, prets: 1, avenir: 2 };
  for (const p of points) {
    const secs = p.arrives.map((x) => (aConfirmer(x, p) ? 'lieu' : sectionDuColis(x, p)));
    const principale = secs.filter((s) => s in RANG_SECTION).sort((a, b) => RANG_SECTION[a] - RANG_SECTION[b])[0] || null;
    // (11 nov., Julien : « organise mieux les retraits ») « Prêts à retirer » et « Code à venir » ne font plus qu'UNE
    // liste « À retirer » (le point où il va, ses colis) : « Code à venir » est dit sur la ligne elle-même.
    const sec = (s0) => (s0 === 'avenir' ? 'prets' : s0);
    p.arrives.forEach((x, i) => parSection[secs[i] in RANG_SECTION ? sec(principale) : secs[i]].push({ x, p }));
  }
  const attendus = connus.flatMap((p) => p.attendus.map((c) => ({ c, p })));
  const routeSans = vChoisie ? [] : (enRoute || []);
  // (13 nov., Julien : « ici ça doit être dans les Mondial Relay » — « un colis = une fois ») LES COLIS REDIRIGÉS
  // (« Votre colis a changé de plan », src/relaisChange.js `colisRelaisChange`) ne forment plus une carte à part :
  // chacun est UNE ligne de la forme commune, sous SON nouveau point, dans « En route » tant qu'il n'est pas arrivé.
  // Un n° déjà dans « À retirer » (arrivé, ou en vérification chez le transporteur) n'y est jamais redit.
  const normSu = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suivisIci = new Set(((vueTout && vueTout.points) || []).flatMap((p) => (p.arrives || []).map((c) => normSu(suiviDe ? suiviDe(c) : ''))).filter(Boolean));
  const redir = (redirige || []).filter((r) => r && normSu(r.suivi) && !suivisIci.has(normSu(r.suivi)));
  const pointsRedir = redir.length ? ((pointsARetirer({ colis: redir.map((r) => ({ ...r, id: r.cle, nom: r.nom || '', adresse: r.adresse || '' })) }) || {}).points || []) : [];
  const nRoute = attendus.length + routeSans.length + redir.length;
  if (!points.length && !villes.length && !nRoute) return null;
  const premiere = new Set();   // le premier point rendu porte `data-relais-point` (les autres : `-suite`)
  // Une carte de point : en-tête (nom · adresse, transporteur commun lu, nombre) sur un fond légèrement différent.
  const cartePoint = (p, items, cleSec) => {
    const rows = items.map((i) => i.x);
    const tStats = [...new Set(rows.map((c) => cleStatTransporteur(c.transp)))];
    const tCommun = rows.length && rows.every((c) => c.transp && !c.trInconnu) && tStats.length === 1 && tStats[0] !== 'pas-lu' ? rows[0].transp : null;
    const ep = nombreEpingle(p);
    // (12 nov., finitions) Plus de barre unique en tête de point : chaque ligne porte SA barre (une forme pour toutes).
    const prem = !premiere.has(p.cle); premiere.add(p.cle);
    const attrs = prem ? { 'data-relais-point': p.cle, 'data-relais-numero': p.numero, 'data-relais-point-arrives': p.nArrives, 'data-relais-point-comptes': p.nComptes, 'data-relais-point-attendus': p.nAttendus, 'data-relais-epingle-n': ep.n, 'data-relais-ville': (villeDuPoint(p) || {}).cle || '',
      'data-relais-repere': !avecCarte ? 'sans-carte' : repereDe(p, reperes) ? 'oui' : 'non', 'data-relais-pas-carte': avecCarte ? codePasSurCarte(p, reperes) : undefined, 'data-relais-urgent': p.urgent ? '1' : undefined } : { 'data-relais-point-suite': p.cle };
    return (
      <section key={cleSec + ':' + p.cle} className={'vrm-rpf-point' + (choisi === p.cle ? ' is-choisi' : '')} {...attrs}>
        <header className="vrm-rpf-tete">
          <span className="vrm-rpf-ident">
            <b className="vrm-rpf-nom" data-relais-nom="">{nomEnseigne(p.nom) || p.adresseCourte || 'Point relais'}</b>
            {/* (11 nov.) Plus de carte (Julien : « ça sert à rien ») : l'itinéraire vers l'adresse LUE, d'un geste, au bout de l'adresse. */}
            {(() => { const adr = p.nom ? (p.adresse || p.adresseCourte || '') : ''; const lieu = [p.nom, p.adresse || p.adresseCourte].filter(Boolean).join(', '); const href = lieu && (p.adresse || p.adresseCourte) && !p.adressePasLue ? lienItineraire(lieu, appareilApple()) : '';   // (intégration) jamais un itinéraire vers un nom seul : l'adresse LUE ou rien
              return (adr || href) ? <span className="vrm-rpf-adr" data-relais-adresse="">{adr}{href ? <>{adr ? ' · ' : ''}<a className="vrm-rpf-itineraire" href={href} target="_blank" rel="noreferrer" data-relais-itineraire="" aria-label={`Itinéraire vers ${p.nom || 'ce point'}`}>Itinéraire</a></> : null}</span> : null; })()}
            {p.adressePasLue ? <span className="vrm-rpf-adr" data-relais-adresse-pas-lue="">Adresse pas lue</span> : null}
            {/* (13 nov.) Les HORAIRES du point, lus dans l'e-mail de retrait (api/_lib/horaires-relais.js), et s'il est
                ouvert à l'heure de Paris. Neutres, jamais ambre. Pas sus ⇒ rien. (13 nov., lot 11) Mondial Relay : lus chez
                le transporteur par le serveur (`horairesDuTransporteur`), datés de leur lecture. */}
            {(() => { const h = horairesDuPoint(rows.map((c) => (c && c.src && c.src.t ? { horaires: c.src.t.horaires, ms: Date.parse((c.src.t.horairesDuTransporteur && c.src.t.horairesAt) || c.src.t.emailAt || c.src.t.receivedAt || '') } : null)).filter(Boolean), (c) => c.ms);
              const txt = texteHoraires(h); if (!txt) return null;
              const e = etatOuverture(h, Date.now()); const ph = phraseOuverture(e);
              return <span className="vrm-rpf-horaires" data-relais-horaires={txt} data-relais-ouvert={e ? (e.ouvert ? '1' : '0') : ''}>{txt}{ph ? <> · <span className="vrm-rpf-horaires-etat" data-relais-ouverture={ph}>{ph}</span></> : null}</span>; })()}
          </span>
          <span className="vrm-rpf-meta">
            {/* (12 nov., finitions) Le logo du transporteur est sur CHAQUE ligne, au coin de la vignette : plus ici.
                Le compte : « N colis · K codes à venir » dès K > 0 (la même règle sur chaque point) ; « sans n° de
                suivi » une fois ici quand AUCUN colis du point n'en a (plus répété sur chaque ligne). */}
            <span className="vrm-rpf-n" data-relais-compte={rows.length} data-relais-transporteur={tCommun ? (tCommun.cle || '') : undefined}>{plur(rows.length, 'colis', 'colis')}{(() => { const n = rows.filter((c) => !c.horsCompte && !(c.code || c.qr || c.code2)).length; return n ? <span data-relais-sans-code={n}> · {plur(n, 'code à venir', 'codes à venir')}</span> : null; })()}{suiviDe && rows.length && rows.every((c) => !String(suiviDe(c) || '')) ? <span data-relais-sans-suivi=""> · sans n° de suivi</span> : null}
              {!p.inconnu && !pressant(p) ? <> · <button type="button" className="vrm-rpf-masquer" data-relais-masquer={p.cle} aria-label={`Masquer ${p.nom || 'ce point'}`} onClick={() => { const m = new Set(masques); m.add(p.cle); setMasques(m); }}>Masquer</button></> : null}</span>
          </span>
        </header>
        <div className="vrm-rpf-liste">{rows.map((x) => ligne(x, false, false))}</div>
      </section>
    );
  };
  const parPoint = (items) => { const m = new Map(); for (const it of items) { const k = it.p.cle; if (!m.has(k)) m.set(k, { p: it.p, items: [] }); m.get(k).items.push(it); } return [...m.values()]; };
  const titre = (t, n, id) => <h3 className="vrm-rpf-section-titre" data-rp-section-titre={id}>{t}<span className="vrm-rpf-section-n">{n}</span></h3>;
  const section = (id, t, items, { ambre = false } = {}) => items.length ? (
    <section className={'vrm-rpf-section' + (ambre ? ' is-ambre' : '')} data-rp-section={id} data-rp-section-n={items.length}>
      {titre(t, items.length, id)}
      <div className="vrm-rpf-section-corps">{parPoint(items).map(({ p, items: its }) => cartePoint(p, its, id))}</div>
    </section>) : null;
  return (
    <div className="vrm-rp vrm-rpf" ref={racine} data-retirer-ville={vChoisie ? vChoisie.cle : ''} data-retirer-sans-ville={sansVille.size} data-retirer-par-point={connus.length} data-retirer-comptes={vue ? vue.nComptes : 0} data-retirer-hors={vue ? vue.nHors : 0} data-retirer-sur-carte={surCarte.length} data-retirer-carte={avecCarte ? '1' : '0'} data-retirer-carte-etat={avecCarte && surCarte.length ? etatFond : undefined}>
      {/* (8 nov.) UNE place, toujours la même, pour la carte : un fond indisponible la cache sans la démonter
          (avant : deux branches, la carte remontait et rechargeait à chaque échec). Au doigt, deux doigts la
          déplacent, un doigt fait défiler la page ; « Agrandir » lui donne plus de place. */}
      {avecCarte && surCarte.length > 0 ? <div className="vrm-rpf-carte" data-retirer-carte-h={hauteurCarte} hidden={etatFond === 'ko' ? true : undefined}>
        <FondRelais points={surCarte} selection={choisi} onChoisir={choisir} C={C} hauteur={hauteurCarte} onEtat={setEtatFond} muet cooperatif={!ordi || auDoigt()}/>
        {/* Obligation de licence : l'attribution reste, en tout petit, DANS la carte. */}
        <span className="vrm-rpf-attrib" data-relais-note="">© OpenFreeMap · OpenMapTiles · OpenStreetMap</span>
        {etatFond === 'pret' ? <button type="button" className="vrm-rpf-agrandir" data-retirer-agrandir={grande ? '1' : '0'} aria-pressed={grande} onClick={() => setGrande((g) => !g)}>{grande ? 'Réduire' : 'Agrandir'}</button> : null}
      </div> : null}
      {villes.length ? <div className="vrm-rpf-villes vrm-seg" role="group" aria-label="Choisir une ville" data-retirer-villes={villes.length}>
        <button type="button" className="vrm-seg-btn" aria-pressed={!vChoisie} data-ville="" onClick={() => onVille && onVille('')}>Toutes</button>
        {villes.map((v) => <button key={v.cle} type="button" className="vrm-seg-btn" aria-pressed={!!vChoisie && vChoisie.cle === v.cle} data-ville={v.cle} data-ville-n={v.n} data-ville-urgence={v.urgence} onClick={() => onVille && onVille(v.cle)}>{v.nom} <span className="vrm-seg-n">{v.n}</span></button>)}
      </div> : null}
      {points.filter((p) => !p.inconnu).length > 1 ? <div className="vrm-rpf-ordre vrm-seg" role="group" aria-label="Ordre des points" data-retirer-ordre={ordre}>
        <button type="button" className="vrm-seg-btn" aria-pressed={ordre === 'recent'} data-ordre="recent" onClick={() => setOrdre('recent')}>Récents</button>
        <button type="button" className="vrm-seg-btn" aria-pressed={ordre === 'limite'} data-ordre="limite" onClick={() => setOrdre('limite')}>Date limite</button>
      </div> : null}
      {section('aujourdhui', 'À retirer aujourd’hui', parSection.aujourdhui, { ambre: true })}
      {/* (5 nov.) Un point y est entier : s'il porte un colis au code à venir, la section dit « À retirer ». */}
      {section('prets', 'À retirer', parSection.prets)}
      {section('avenir', 'Code à venir', parSection.avenir)}
      {parSection.lieu.length ? (
        <section className="vrm-rpf-section" data-rp-section="lieu" data-rp-section-n={parSection.lieu.length}>
          {titre('Lieu à confirmer', parSection.lieu.length, 'lieu')}
          <div className="vrm-rpf-section-corps">
            {parPoint(parSection.lieu.filter((i) => !i.p.inconnu)).map(({ p, items: its }) => cartePoint(p, its, 'lieu'))}
            {parSection.lieu.some((i) => i.p.inconnu) ? <section className="vrm-rpf-point is-inconnu" data-relais-point={parSection.lieu.find((i) => i.p.inconnu).p.cle} data-relais-point-comptes={parSection.lieu.filter((i) => i.p.inconnu).length}>
              <div className="vrm-rpf-liste">{parSection.lieu.filter((i) => i.p.inconnu).map(({ x }) => ligne(x))}</div>
            </section> : null}
          </div>
        </section>) : null}
      {parSection.verifier.length ? (
        <details className="vrm-rpf-section is-repli vrm-rpf-verifier" data-rp-section="verifier" data-rp-section-n={parSection.verifier.length} data-retirer-a-verifier={parSection.verifier.length}>
          <summary className="vrm-rpf-section-titre is-repli"><span>À vérifier<span className="vrm-rpf-section-n">{parSection.verifier.length}</span></span><span className="vrm-rpf-chevron" aria-hidden="true">›</span></summary>
          <div className="vrm-rpf-section-corps"><section className="vrm-rpf-point"><div className="vrm-rpf-liste">{parSection.verifier.map(({ x }) => ligne(x))}</div></section></div>
        </details>) : null}
      {parSection.double.length ? (
        <details className="vrm-rpf-section is-repli vrm-rpf-double" data-rp-section="double" data-rp-section-n={parSection.double.length} data-retirer-en-double={parSection.double.length}>
          {/* (9 nov., 17 h 24, Julien : « TU NE PEUX PAS AVOIR D'HÉSITATION ») Plus de « peut-être » ni de paragraphe :
              chaque moitié Vinted a UN état, sur SA ligne — « Compté avec le n°…1234 » (le colis du transporteur
              arrivé au même point, compté une fois). Un témoin = un carton : une moitié sans témoin libre est à
              retirer, comptée ; une moitié dont le témoin est fini est dans les sortis (api/_lib/achat-arrive-relais.js). */}
          <summary className="vrm-rpf-section-titre is-repli"><span>Comptés avec un autre colis<span className="vrm-rpf-section-n">{parSection.double.length}</span></span><span className="vrm-rpf-chevron" aria-hidden="true">›</span></summary>
          <div className="vrm-rpf-section-corps"><section className="vrm-rpf-point"><div className="vrm-rpf-liste">{parSection.double.map(({ x }) => ligne(x))}</div></section></div>
        </details>) : null}
      {masquesIci.length ? <button type="button" className="vrm-rpf-masques" data-relais-masques={masquesIci.length} data-relais-masques-colis={masquesIci.reduce((t, p) => t + p.nComptes, 0)}
        onClick={() => { const m = new Set(masques); for (const p of masquesIci) m.delete(p.cle); setMasques(m); }}>
        {masquesIci.length === 1 ? '1 point masqué' : `${masquesIci.length} points masqués`} · Afficher</button> : null}
      {nRoute ? (
        <details className="vrm-rpf-section is-repli vrm-rpf-route" data-rp-section="route" data-rp-section-n={nRoute} data-retirer-en-route-sans={routeSans.length}>
          <summary className="vrm-rpf-section-titre is-repli"><span>En route<span className="vrm-rpf-section-n">{nRoute}</span></span><span className="vrm-rpf-chevron" aria-hidden="true">›</span></summary>
          <div className="vrm-rpf-section-corps">
            {pointsRedir.map((p) => (
              <section key={'rd:' + p.cle} className="vrm-rpf-point is-redirige" data-relais-redirige-point={p.inconnu ? 'pas-lu' : p.cle} data-relais-redirige-n={p.arrives.length}>
                <header className="vrm-rpf-tete">
                  <span className="vrm-rpf-ident">
                    <b className="vrm-rpf-nom" data-relais-nom="">{p.inconnu ? 'Nouveau point pas encore lu' : (nomEnseigne(p.nom) || p.adresseCourte || 'Point relais')}</b>
                    {!p.inconnu && (p.adresse || p.adresseCourte) ? <span className="vrm-rpf-adr" data-relais-adresse="">{p.adresse || p.adresseCourte}{p.nom && !p.adressePasLue ? <> · <a className="vrm-rpf-itineraire" href={lienItineraire([p.nom, p.adresse || p.adresseCourte].join(', '), appareilApple())} target="_blank" rel="noreferrer" data-relais-itineraire="" aria-label={`Itinéraire vers ${p.nom}`}>Itinéraire</a></> : null}</span> : null}
                  </span>
                  <span className="vrm-rpf-meta"><span className="vrm-rpf-n" data-relais-compte={p.arrives.length}>{plur(p.arrives.length, 'colis', 'colis')}</span></span>
                </header>
                <div className="vrm-rpf-liste">{p.arrives.map((x) => <LigneRetraitF key={x.cle || x.id} x={x} Photo={Photo} gestes={null} detail={null} echeance={null} statut={null} retirer={null} C={C} avecTransp={false} titreDe={titreDe} delai={delai} delaiEnTete={false} suiviDe={suiviDe} qrDe={null}/>)}</div>
              </section>))}
            {attendus.length + routeSans.length ? <section className="vrm-rpf-point"><div className="vrm-rpf-liste" data-en-route-liste={nRoute}>
            {attendus.map(({ c, p }) => (
              <div key={c.id} className="vrm-rpf-ligne is-attendu" data-relais-attendu={c.id} data-relais-estimee={c.estimee || ''} data-en-route-achat={c.id}>
                <div className="vrm-rpf-rang"><span className="vrm-rpf-vignette is-sans" aria-hidden="true"/><span className="vrm-rpf-quoi"><span className="vrm-rpf-titre">{c.titre || 'Achat'}</span><span className="vrm-rpf-puces"><span className="vrm-rpf-puce">{p.nom || 'Point relais'}</span>{c.estimee ? <span className="vrm-rpf-puce">vers le {jourFr(c.estimee)}</span> : null}</span></span></div>
              </div>))}
            {routeSans.map((a) => (
              <div key={a.id} className="vrm-rpf-ligne is-attendu" data-en-route-achat={a.id}><div className="vrm-rpf-rang">
                <span className={'vrm-rpf-vignette' + (a.photo && Photo ? '' : ' is-sans')} aria-hidden="true">{a.photo && Photo ? Photo(a.photo) : null}</span>
                <span className="vrm-rpf-quoi"><span className="vrm-rpf-titre">{a.titre || 'Achat'}</span><span className="vrm-rpf-puces"><span className="vrm-rpf-puce">en route</span></span></span>
              </div></div>))}
          </div></section> : null}</div>
        </details>) : null}
    </div>
  );
}

export function ColonneRetirer({ vue, C, Photo, gestes = null, detail = null, nomTransporteur = null, avecCarte = true, ordi = true, delai = null, enRouteSansRelais = 0, fusion = false, echeance = null, statut = null, retirer = null, ville = '', onVille = null, titreDe = null, enRoute = [], suiviDe = null, qrDe = null, redirige = [] }) {
  if (fusion) return <ColonneRetirerF vue={vue} C={C} Photo={Photo} gestes={gestes} detail={detail} avecCarte={avecCarte} ordi={ordi} delai={delai} echeance={echeance} statut={statut} retirer={retirer} ville={ville} onVille={onVille} titreDe={titreDe} enRoute={enRoute} suiviDe={suiviDe} qrDe={qrDe} redirige={redirige}/>;
  const points = (vue && vue.points) || [];
  const connus = points.filter((p) => !p.inconnu);
  const inconnu = points.find((p) => p.inconnu) || null;
  // Au téléphone (pas de carte) : aucune adresse n'est cherchée pour la carte.
  const reperes = useReperes(connus.filter(surLaCarte), avecCarte && connus.some(surLaCarte));
  const [choisi, setChoisi] = React.useState('');
  const [etatFond, setEtatFond] = React.useState('charge');
  const racine = React.useRef(null);
  const surCarte = avecCarte ? connus.filter(surLaCarte).map((p) => { const r = repereDe(p, reperes); return r ? { ...p, lat: r.lat, lon: r.lon } : null; }).filter(Boolean) : [];
  const choisir = (cle) => {
    setChoisi(cle);
    const el = racine.current && [...racine.current.querySelectorAll('[data-relais-point]')].find((e) => e.getAttribute('data-relais-point') === cle);
    if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { el.scrollIntoView(); } }
  };
  const carteVisible = avecCarte && surCarte.length > 0 && etatFond !== 'ko';
  // Les « à vérifier » de TOUS les points (et du point inconnu) : un groupe à part, en bas.
  const aVerifier = points.flatMap((p) => p.arrives.filter((c) => c.horsCompte));
  const raisons = aVerifier.map((c) => c.raisonVerif || 'délai dépassé ou incident');
  const raisonCommune = raisons.length && raisons.every((r) => r === raisons[0]) ? raisons[0] : '';
  const inconnusComptes = inconnu ? inconnu.arrives.filter((c) => !c.horsCompte) : [];
  if (!points.length && !enRouteSansRelais) return null;
  return (
    <div className="vrm-rp" ref={racine} data-retirer-par-point={connus.length} data-retirer-comptes={vue ? vue.nComptes : 0} data-retirer-hors={vue ? vue.nHors : 0} data-retirer-sur-carte={surCarte.length} data-retirer-carte={avecCarte ? '1' : '0'}>
      {avecCarte && surCarte.length > 0 && <FondRelais points={surCarte} selection={choisi} onChoisir={choisir} C={C} hauteur={240} onEtat={setEtatFond} muet/>}
      {connus.map((p) => {
        const comptes = p.arrives.filter((c) => !c.horsCompte);
        if (!comptes.length && !p.attendus.length) return null;
        // La date limite d'un colis ne s'écrit sur SA carte que si les colis du
        // point n'ont pas la même (sinon c'est la phrase de l'en-tête, §7).
        const jMixte = new Set(comptes.map((c) => c.jours).filter((j) => j != null)).size > 1;
        const raisonCarte = carteVisible ? (raisonPasSurCarte(p, reperes) || null) : null;
        const lim = texteLimite(p.prochaineLimite);
        const ep = nombreEpingle(p);
        // Le transporteur du point : celui que la source NOMME, et seulement s'il est
        // le même pour tous ses colis (jamais « Vinted Go » écrit en dur).
        const trs = [...new Set(comptes.map((c) => c.transporteur || ''))];
        const trCode = trs.length === 1 && trs[0] ? trs[0] : '';
        const trNom = trCode && nomTransporteur ? nomTransporteur(trCode) : '';
        // (2 nov.) Le transporteur LU (logo + nom) : une fois en tête quand tous les colis
        // du point ont le même ; sinon sur chaque carte (§7 : jamais dit deux fois).
        const tStats = [...new Set(comptes.map((c) => cleStatTransporteur(c.transp)))];
        const tCommun = comptes.length && comptes.every((c) => c.transp) && tStats.length === 1 ? comptes[0].transp : null;
        const tParCarte = comptes.some((c) => c.transp) && !tCommun;
        const morceaux = [
          p.nComptes ? plur(p.nComptes, 'colis', 'colis') : null,
          p.nAttendus ? `${p.nAttendus} en route` : null,
        ].filter(Boolean);
        return (
          <section key={p.cle} className={'vrm-rp-point' + (choisi === p.cle ? ' is-choisi' : '')} data-relais-point={p.cle} data-relais-numero={p.numero}
            data-relais-point-arrives={p.nArrives} data-relais-point-comptes={p.nComptes} data-relais-point-attendus={p.nAttendus} data-relais-epingle-n={ep.n}
            data-relais-repere={!avecCarte ? 'sans-carte' : repereDe(p, reperes) ? 'oui' : (raisonCarte && raisonCarte !== EN_COURS ? 'non' : 'cherche')} data-relais-pas-carte={avecCarte ? codePasSurCarte(p, reperes) : undefined} data-relais-urgent={p.urgent ? '1' : undefined}>
            <header className="vrm-rp-tete">
              {carteVisible ? <span className={'vrm-rp-numero vrm-rp-compte vrm-rp-epingle' + (ep.sorte === 'aretirer' && repereDe(p, reperes) ? ' is-fort' : '')} data-relais-pastille={ep.n} data-relais-pastille-sorte={ep.sorte} aria-hidden="true" title="Son épingle sur la carte">{ep.n}</span> : null}
              <span className="vrm-rp-ident">
                <b className="vrm-rp-nom" data-relais-nom="">{p.nom || p.adresseCourte || 'Point relais'}</b>
                {p.nom && (p.adresse || p.adresseCourte) ? <span className="vrm-rp-adresse" data-relais-adresse="">{p.adresse || p.adresseCourte}</span> : null}
                {tCommun && (tCommun.cle || tCommun.nom || !comptes.some((c) => c.trInconnu))
                  ? <span className="vrm-rp-transp" data-relais-transporteur={trCode || tCommun.cle || ''}><PastilleTransporteur t={tCommun} C={C} seul taille={18}/></span>
                  : (trNom && !tParCarte ? <span className="vrm-rp-transp" data-relais-transporteur={trCode}><PastilleTransporteur t={{ cle: cleTransporteur(trCode), nom: trNom }} C={C} seul taille={18}/></span> : null)}
                {(() => { const n = comptes.filter((c) => c.trInconnu).length; return n ? <span className="vrm-rp-adresse" data-transp="transporteur-inconnu" data-transp-n={n}>Transporteur pas encore connu{n > 1 ? ` pour ${n} colis` : ''} : le suivi Vinted ne le nomme pas</span> : null; })()}
                <span className="vrm-rp-resume">
                  {morceaux.map((m, i) => <span key={i} data-relais-compte={i === 0 && p.nComptes ? p.nComptes : undefined}>{i ? ' · ' : ''}{m}</span>)}
                  {lim && p.nComptes ? <span className={p.urgent ? 'is-ambre' : ''} data-relais-limite={p.prochaineLimite}> · {lim}</span> : null}
                </span>
                {raisonCarte ? <span className="vrm-rp-pas-carte" data-relais-sans-repere="" data-raison={codePasSurCarte(p, reperes)}>Pas sur la carte : {raisonCarte}.</span> : null}
              </span>
            </header>
            <div className="vrm-rp-liste">
              {comptes.map((x) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} limiteSurCarte={jMixte} C={C} avecTransporteur={tParCarte && !x.trInconnu}/>)}
              {p.attendus.map((c) => (
                <div key={c.id} className="vrm-rp-attendu" data-relais-attendu={c.id} data-relais-estimee={c.estimee || ''}>
                  En route{c.titre ? ` · ${c.titre}` : ''} — {c.estimee ? <>arrivée estimée {jourFr(c.estimee)}</> : <span>date d’arrivée pas encore dite</span>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {inconnusComptes.length > 0 && (
        <section className="vrm-rp-point vrm-rp-inconnu" data-relais-point={inconnu.cle} data-relais-point-arrives={inconnu.nArrives} data-relais-point-comptes={inconnu.nComptes}>
          <header className="vrm-rp-tete">
            <span className="vrm-rp-ident">
              <b className="vrm-rp-nom">Point pas encore connu</b>
              {(() => { const n = inconnusComptes.filter((c) => c.trInconnu).length; return n ? <span className="vrm-rp-adresse" data-transp="transporteur-inconnu" data-transp-n={n}>Transporteur pas encore connu{n > 1 ? ` pour ${n} colis` : ''} : le suivi Vinted ne le nomme pas</span> : null; })()}
              <span className="vrm-rp-resume">{plur(inconnu.nComptes, 'colis', 'colis')} — le message reçu ne dit pas encore où {inconnu.nComptes > 1 ? 'ils sont' : 'il est'}</span>
            </span>
          </header>
          <div className="vrm-rp-liste">
            {inconnusComptes.map((x) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} C={C} avecTransporteur={!x.trInconnu}/>)}
          </div>
        </section>
      )}
      {enRouteSansRelais > 0 && <p className="vrm-rp-note" data-retirer-en-route-sans={enRouteSansRelais}>{plur(enRouteSansRelais, 'achat')} en route dont Vinted ne dit pas encore le point d’arrivée.</p>}
      {aVerifier.length > 0 && (
        <section className="vrm-rp-point vrm-rp-verifier" data-retirer-a-verifier={aVerifier.length}>
          <header className="vrm-rp-tete">
            <div className="vrm-rp-ident">
              <b className="vrm-rp-nom">À vérifier · {aVerifier.length}</b>
              {(() => { const n = aVerifier.filter((c) => c.trInconnu).length; return n ? <div className="vrm-rp-adresse" data-transp="transporteur-inconnu" data-transp-n={n}>Transporteur pas encore connu{n > 1 ? ` pour ${n} colis` : ''} : le suivi Vinted ne le nomme pas</div> : null; })()}
              {(() => { const n = aVerifier.filter((c) => String(c.cle || '').startsWith('r:c:')).length; return n ? <div className="vrm-rp-resume" data-en-verification={n}>{n > 1 ? `${n} achats en cours de vérification` : '1 achat en cours de vérification'} : au relais selon Vinted, peut-être un colis ci-dessus. Hors du compte.</div> : null; })()}
              <div className="vrm-rp-resume">{raisonCommune ? `${raisonCommune[0].toUpperCase()}${raisonCommune.slice(1)}. ` : ''}Hors du compte « à retirer » : regarde le suivi. Retiré ? Touche « J’ai retiré ».{(() => { const n = aVerifier.filter((c) => c.encoreCode || c.code || c.qr).length; return n ? ` ${n > 1 ? `${n} ont encore leur code ou leur QR` : '1 a encore son code ou son QR'} : peut-être encore au relais.` : ''; })()}</div>
            </div>
          </header>
          <div className="vrm-rp-liste">
            {aVerifier.map((x, i) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} avecLieu raison={raisonCommune ? '' : raisons[i]} C={C} avecTransporteur={!x.trInconnu}/>)}
          </div>
        </section>
      )}
      {carteVisible && <div className="vrm-rp-note vrm-rp-attrib" data-relais-note=""><div>Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap</div><div>Adresses : Vinted, adresse.data.gouv.fr</div></div>}
    </div>
  );
}

// `compacte` (31 oct.) : posée ouverte, sans en-tête : le fond, puis une ligne
// par point. Ailleurs elle reste repliée, comme avant.
// (1er nov.) `sansListe` : le fond seul (la tournée de Ma journée liste ses
// arrêts elle-même, dans SON ordre) ; `etiquette(p)` : le texte de l'épingle
// (le numéro de l'arrêt) — sinon le nombre de colis, comme avant.
export default function CarteRelaisColis({ donnees, C, compacte = false, sansListe = false, etiquette = null }) {
  const [ouverte, setOuverte] = React.useState(!!compacte);
  const [choisi, setChoisi] = React.useState('');
  const groupes = (donnees && donnees.groupes) || [];
  const reperes = useReperes(groupes.filter((g) => !g.inconnu), ouverte);
  if (!donnees) return null;
  const nArr = groupes.reduce((t, g) => t + g.nArrives, 0), nAtt = groupes.reduce((t, g) => t + g.nAttendus, 0);
  const sansRelais = Number(donnees.enRouteSansRelais) || 0;
  if (!groupes.length && !sansRelais) return null;
  const avecRepere = groupes.filter((g) => !g.inconnu && repereDe(g, reperes)).map((g) => ({ ...g, ...repereDe(g, reperes) }));
  const muted = { fontSize: 12, color: C.muted, lineHeight: 1.5 };
  const etatRepere = (g) => (repereDe(g, reperes) ? 'oui' : (g.inconnu || !g.geocode || (reperes[g.cle] && reperes[g.cle].echec) || reperes[g.cle] === 'reseau' ? 'non' : 'cherche'));
  const nomDe = (g) => g.nom || (g.inconnu ? 'Point pas encore connu' : g.adresseCourte || 'Point relais');
  if (compacte) return (
    <div className="vrm-relais-carte vrm-relais-compacte" data-relais-carte="ouverte" data-relais-points={groupes.length} data-relais-arrives={nArr} data-relais-attendus={nAtt} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {avecRepere.length > 0 && <FondRelais points={avecRepere} selection={choisi} onChoisir={setChoisi} C={C} etiquette={etiquette || ((g) => g.nArrives + g.nAttendus)}/>}
      {!sansListe && groupes.map((g) => (
        <div key={g.cle} data-relais-point={g.cle} data-relais-point-arrives={g.nArrives} data-relais-point-attendus={g.nAttendus} data-relais-repere={etatRepere(g)} style={{ ...muted, color: C.text }}>
          <b>{nomDe(g)}</b>{g.nArrives ? ` · ${g.nArrives} arrivé${g.nArrives > 1 ? 's' : ''}` : ''}{g.nAttendus ? ` · ${g.nAttendus} attendu${g.nAttendus > 1 ? 's' : ''}` : ''}
          {etatRepere(g) === 'non' && !g.inconnu ? <span style={{ color: C.muted }}> · pas sur la carte</span> : null}
        </div>
      ))}
      {sansListe && avecRepere.length === 0 && <div data-relais-sans-repere-tous="" style={muted}>{groupes.some((g) => etatRepere(g) === 'cherche') ? 'Je place les points sur la carte…' : 'Aucun point n’a pu être placé sur la carte : adresse incomplète ou pas trouvée sûrement.'}</div>}
      {!sansListe && sansRelais > 0 && <div style={{ ...muted, fontSize: 11.5 }}>{sansRelais} achat{sansRelais > 1 ? 's' : ''} en route sans destination connue.</div>}
      {avecRepere.length > 0 && <div data-relais-note="" style={{ ...muted, fontSize: 10.5 }}>Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : adresse.data.gouv.fr.</div>}
    </div>
  );
  return (
    <div className="vrm-relais-carte" data-relais-carte={ouverte ? 'ouverte' : 'fermee'} data-relais-points={groupes.length} data-relais-arrives={nArr} data-relais-attendus={nAtt} style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOuverte((o) => !o)} aria-expanded={ouverte} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.text }}>Par point relais</span>
          <span style={{ display: 'block', ...muted }}>{groupes.length ? `${groupes.length} point${groupes.length > 1 ? 's' : ''} · ${nArr} déjà arrivé${nArr > 1 ? 's' : ''}${nAtt ? ` · ${nAtt} attendu${nAtt > 1 ? 's' : ''}` : ''}` : 'Aucune destination encore connue'}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 15, color: C.muted }}>{ouverte ? '▴' : '▾'}</span>
      </button>
      {ouverte && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {avecRepere.length > 0 && <FondRelais points={avecRepere} selection={choisi} onChoisir={setChoisi} C={C} etiquette={(g) => g.nArrives + g.nAttendus}/>}
          {groupes.map((g) => {
            const er = etatRepere(g);
            return (
              <div key={g.cle} data-relais-point={g.cle} data-relais-point-arrives={g.nArrives} data-relais-point-attendus={g.nAttendus} data-relais-repere={er}
                style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, outline: choisi === g.cle ? `2px solid ${C.accent}` : 'none', outlineOffset: 2, borderRadius: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{nomDe(g)}</div>
                {g.adresse ? <div style={muted}>{g.adresse}</div> : null}
                {er === 'non' && !g.inconnu && <div data-relais-sans-repere="" style={{ ...muted, fontSize: 11.5 }}>{!g.geocode ? "Pas sur la carte : l'adresse lue est incomplète (il faut la rue et le code postal)." : "Pas sur la carte : cette adresse n'a pas été trouvée sûrement."}</div>}
                {g.nArrives > 0 && <div data-relais-ligne="arrives" style={{ fontSize: 13, color: C.text, marginTop: 4 }}><b>{g.nArrives}</b> déjà arrivé{g.nArrives > 1 ? 's' : ''}{(() => { const sc = g.arrives.filter((c) => !c.aCode).length; return sc ? ` · ${sc} sans code pour l'instant` : ''; })()}</div>}
                {g.attendus.map((c) => (
                  <div key={c.id} data-relais-attendu={c.id} data-relais-estimee={c.estimee || ''} style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>
                    En route{c.titre ? ` · ${c.titre}` : ''} — {c.estimee ? <>arrivée estimée {jourFr(c.estimee)}</> : <span style={{ color: C.muted }}>date d'arrivée pas encore dite</span>}
                  </div>
                ))}
              </div>
            );
          })}
          <div data-relais-note="" style={{ ...muted, fontSize: 11.5 }}>
            Arrivées estimées par Vinted, pas une promesse.{sansRelais > 0 ? ` ${sansRelais} achat${sansRelais > 1 ? 's' : ''} en route sans destination connue.` : ''}
            <div>Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : adresse.data.gouv.fr</div>
            <Pourquoi>Un colis n'est rangé sous un point que par ce qui le désigne lui (l'e-mail du transporteur, la conversation, ou le suivi Vinted de CET achat) — jamais deviné.{sansRelais > 0 ? ' La destination d’un achat ne vient que de son suivi Vinted, quand il la donne (l’extension le relit en passant).' : ''}</Pourquoi>
          </div>
        </div>
      )}
    </div>
  );
}
