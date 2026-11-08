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
import React from 'react';
import { jugerBan, requetesBan, nombreEpingle, RAISONS_BAN } from './relaisColis.js';
import { villeDuPoint as villeDuPointRegle, villesDesPoints as villesDesPointsRegle, pointsSansVille as pointsSansVilleRegle, communesDepuisBan, LIMITE_COMMUNES } from './villeRelais.js';
import './styles-colis-colonnes.css';
import PastilleTransporteur, { BadgeTransporteur } from './PastilleTransporteur.jsx';
import { cleStatTransporteur } from './transporteursVisuels.js';
import { attrCible } from './cibleNotif.js';
import { explicationEnDouble } from './retraitPreuves.js';

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
export function FondRelais({ points, selection, onChoisir, C, etiquette, hauteur = 260, onEtat, muet = false }) {
  const boite = React.useRef(null);
  const elements = React.useRef(new Map());
  const [etat, setEtat] = React.useState('charge');
  React.useEffect(() => { if (onEtat) onEtat(etat); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [etat]);
  const texte = (p) => String(etiquette ? etiquette(p) : nombreEpingle(p).n);
  const cle = points.map((p) => `${p.cle}:${p.lat}:${p.lon}:${texte(p)}:${nombreEpingle(p).sorte}`).join('|');
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
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2], zoom: 12, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
        carte.once('load', () => {
          try { carte.resize(); } catch (_) {}
          if (points.length > 1) carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: { top: 48, bottom: 64, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
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
            el.textContent = texte(p);
            // Une seule couleur d'accent, rare (§7) : l'épingle d'un point où des
            // colis ATTENDENT d'être retirés ; les autres restent neutres.
            const fort = ep.sorte === 'aretirer';
            el.style.cssText = `min-width:34px;height:34px;padding:0 8px;border-radius:17px;border:2px solid #fff;font:700 14px/30px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);color:${fort ? '#fff' : '#1d2430'};background:${fort ? (C.accent || '#2f5bd3') : '#fff'}`;
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
    return () => { vivant = false; for (const m of marqueurs) { try { m.remove(); } catch (_) {} } if (carte) carte.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  React.useEffect(() => { marquerChoisi(elements.current, selection); }, [selection]);
  const ko = etat === 'ko';
  return (
    <div style={{ position: 'relative' }}>
      <div ref={boite} data-relais-fond={etat} data-relais-cadre={points.length ? [Math.min(...points.map((p) => p.lon)), Math.min(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lon)), Math.max(...points.map((p) => p.lat))].map((v) => Number(v).toFixed(3)).join(',') : ''} className="vrm-relais-fond" aria-hidden={ko ? 'true' : undefined}
        style={{ width: '100%', height: hauteur, borderRadius: 10, overflow: 'hidden', background: '#eaeef2', ...(ko ? { position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' } : null) }}/>
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
  const attrs = { 'data-cc-carte': x.cle, 'data-cible': cibleRetrait(x.cle), 'data-cc-dans': 'retirer', 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined, 'data-hors-compte': x.horsCompte ? '1' : undefined, 'data-sans-lieu': x.sansLieu ? '1' : undefined, 'data-colis-ident': x.cle, 'data-en-verification-tx': String(x.cle || '').startsWith('r:c:') ? String(x.cle).slice(4) : undefined,
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
function LigneRetraitF({ x, Photo, gestes, detail, echeance, statut, retirer, C = null, avecTransp = false, titreDe = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  const detailId = React.useId();
  const [copie,setCopie]=React.useState(false);
  const copieGen=React.useRef(0);
  React.useEffect(()=>{copieGen.current++;setCopie(false);return()=>{copieGen.current++;};},[x.cle,x.code]);
  const voirCode=async()=>{setOuvert(true);if(!x.code)return;const gen=copieGen.current;try{await navigator.clipboard.writeText(String(x.code));if(gen===copieGen.current)setCopie(true);}catch(_){if(gen===copieGen.current)setCopie(false);}};
  const ph = x.photo && Photo ? Photo(x.photo) : null;
  const e = echeance ? echeance(x) : null;
  const st = statut ? statut(x) : null;
  const aCode = !!(x.code || x.qr || x.code2);
  const attrs = { 'data-cc-carte': x.cle, 'data-cible': cibleRetrait(x.cle), 'data-cc-dans': 'retirer', 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined, 'data-hors-compte': x.horsCompte ? '1' : undefined, 'data-sans-lieu': x.sansLieu ? '1' : undefined, 'data-colis-ident': x.cle, 'data-en-verification-tx': String(x.cle || '').startsWith('r:c:') ? String(x.cle).slice(4) : undefined,
    'data-a-verifier-raison': x.horsCompte && x.raisonCode ? x.raisonCode : undefined, 'data-a-verifier-code': x.horsCompte ? (x.encoreCode || x.code || x.qr ? 'oui' : 'non') : undefined,
    'data-transporteur': x.transp ? cleStatTransporteur(x.transp) : undefined };
  const basculer = () => setOuvert((o) => !o);
  return (
    <div className="vrm-rpf-ligne" {...attrs} data-ouvert={ouvert ? '1' : undefined}>
      {/* Le code de CE colis, lisible par les autres écrans et les bancs (`data-code-retrait`) ; affiché au toucher. */}
      {x.code ? <span hidden data-code-retrait={x.code}/> : null}
      <div className="vrm-rpf-rang">
        <button type="button" className="vrm-rpf-ouvrir" aria-expanded={ouvert} aria-controls={detailId} onClick={basculer}>
        <span className={'vrm-rpf-vignette' + (ph ? '' : ' is-sans')} aria-hidden="true" data-sans-photo={ph ? undefined : ''}>
          {ph || <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>}
          {/* (7 nov.) Le logo du transporteur LU, dans le coin de la vignette — seulement quand le nom
              est dit par l'en-tête du point (sinon la puce de la ligne le porte déjà, logo compris). */}
          {!avecTransp && x.transp ? <BadgeTransporteur t={x.transp}/> : null}
        </span>
        <span className="vrm-rpf-quoi">
          <span className="vrm-rpf-titre" title={x.titre} data-rp-titre="">{x.num ? `N°${x.num} · ` : ''}{(titreDe && titreDe(x)) || x.titre || 'Colis'}</span>
          {(st || e || (avecTransp && x.transp)) ? <span className="vrm-rpf-puces">
            {avecTransp && x.transp ? <span className="vrm-rpf-transp-ligne"><PastilleTransporteur t={x.transp} C={C} seul taille={16}/></span> : null}
            {st ? <span className="vrm-rpf-puce is-ambre" data-rp-statut="">{st}</span> : null}
            {e ? <span className={'vrm-rpf-puce' + (e.ambre ? ' is-ambre' : '')} data-rp-echeance={e.code || ''}>{e.t}</span> : null}
            {!aCode && !x.horsCompte ? <span className="vrm-rpf-puce" data-rp-code-a-venir="">Code à venir</span> : null}
          </span> : (!aCode && !x.horsCompte ? <span className="vrm-rpf-puces"><span className="vrm-rpf-puce" data-rp-code-a-venir="">Code à venir</span></span> : null)}
        </span>
        <span className="vrm-rpf-chevron" aria-hidden="true">{ouvert ? '⌃' : '⌄'}</span>
        </button>
        {aCode ? <button type="button" className="vrm-rpf-code" data-rp-code="" aria-label="Voir le code de retrait" onClick={(ev) => { ev.stopPropagation(); voirCode(); }}>{copie?'Copié':'Code'}</button> : null}
        {retirer ? <button type="button" className="vrm-rpf-retire" data-colis-retire="" aria-label="J’ai retiré ce colis" onClick={(ev) => { ev.stopPropagation(); retirer(x); }}>J’ai retiré</button> : null}
      </div>
      {ouvert ? <div className="vrm-rpf-detail" id={detailId} data-rp-detail="">
        <strong className="vrm-rpf-titre-complet">{x.num ? `N°${x.num} · ` : ''}{(titreDe && titreDe(x)) || x.titre || 'Colis'}</strong>
        {detail ? <div className="vrm-rpf-detail-txt">{detail(x)}</div> : null}
        {gestes ? <div className="vrm-rp-gestes">{gestes(x)}</div> : null}
      </div> : null}
    </div>
  );
}
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
  return (x.code || x.qr || x.code2) ? 'prets' : 'avenir';
}
function ColonneRetirerF({ vue: vueTout, C, Photo, gestes, detail, avecCarte, echeance, statut, retirer, ville = '', onVille = null, titreDe = null, enRoute = [] }) {
  const tousConnus = ((vueTout && vueTout.points) || []).filter((p) => !p.inconnu);
  const reperes = useReperes(tousConnus, avecCarte && tousConnus.length > 0);
  useCommunesCp(vueTout, true);
  const villes = villesDesPoints(vueTout);
  const vChoisie = villes.find((v) => v.cle === ville) || null;
  // Une ville choisie montre SES points ; un colis sans ville (lieu à confirmer, ou point sans ville
  // ni code postal lus) n'est JAMAIS caché par ce choix (§5 : un colis caché est un colis perdu).
  const sansVille = new Set(pointsSansVille(vueTout));
  const vue = vChoisie ? { ...vueTout, points: ((vueTout && vueTout.points) || []).filter((p) => vChoisie.points.includes(p.cle) || sansVille.has(p.cle)) } : vueTout;
  const points = (vue && vue.points) || [];
  const connus = points.filter((p) => !p.inconnu);
  const [choisi, setChoisi] = React.useState('');
  const [etatFond, setEtatFond] = React.useState('charge');
  const racine = React.useRef(null);
  const surCarte = avecCarte ? connus.map((p) => { const r = repereDe(p, reperes); return r ? { ...p, lat: r.lat, lon: r.lon } : null; }).filter(Boolean) : [];
  const choisir = (cle) => {
    setChoisi(cle);
    const el = racine.current && [...racine.current.querySelectorAll('[data-relais-point]')].find((e) => e.getAttribute('data-relais-point') === cle);
    if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { el.scrollIntoView(); } }
  };
  const trConnu = (x) => !!(x.transp && !x.trInconnu && cleStatTransporteur(x.transp) !== 'pas-lu');
  const ligne = (x, parLigne = true) => <LigneRetraitF key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} echeance={x.horsCompte ? null : echeance} statut={x.horsCompte ? statut : null} retirer={retirer} C={C} avecTransp={parLigne && trConnu(x)} titreDe={titreDe}/>;
  // Le rangement : chaque colis dans SA section, avec son point.
  const parSection = { aujourdhui: [], prets: [], avenir: [], lieu: [], verifier: [], double: [] };
  // (3 nov., 19 h) Une ville choisie : un point SANS ville (nom seul, homonyme) va sous « Lieu à
  // confirmer », avec son nom — jamais compté dans la ville, jamais caché.
  const aConfirmer = (x, p) => !!vChoisie && !p.inconnu && sansVille.has(p.cle) && !x.horsCompte && !(Number.isFinite(x.jours) && x.jours <= 0);
  // (5 nov., Julien : « ça me met 2 points de retrait alors que c'est le même ») UN POINT,
  // UNE CARTE : un point qui a un colis prêt ET un colis au code à venir était dessiné deux
  // fois (« Prêts à retirer » puis « Code à venir »). Le point va dans la section de son colis
  // le plus pressé, avec tous ses colis ; chaque ligne garde sa puce (« Code à venir »,
  // « dernier jour »). « Lieu à confirmer » et « À vérifier » ne bougent pas.
  const RANG_SECTION = { aujourdhui: 0, prets: 1, avenir: 2 };
  for (const p of points) {
    const secs = p.arrives.map((x) => (aConfirmer(x, p) ? 'lieu' : sectionDuColis(x, p)));
    const principale = secs.filter((s) => s in RANG_SECTION).sort((a, b) => RANG_SECTION[a] - RANG_SECTION[b])[0] || null;
    p.arrives.forEach((x, i) => parSection[secs[i] in RANG_SECTION ? principale : secs[i]].push({ x, p }));
  }
  const attendus = connus.flatMap((p) => p.attendus.map((c) => ({ c, p })));
  const routeSans = vChoisie ? [] : (enRoute || []);
  const nRoute = attendus.length + routeSans.length;
  if (!points.length && !villes.length && !nRoute) return null;
  const premiere = new Set();   // le premier point rendu porte `data-relais-point` (les autres : `-suite`)
  // Une carte de point : en-tête (nom · adresse, transporteur commun lu, nombre) sur un fond légèrement différent.
  const cartePoint = (p, items, cleSec) => {
    const rows = items.map((i) => i.x);
    const tStats = [...new Set(rows.map((c) => cleStatTransporteur(c.transp)))];
    const tCommun = rows.length && rows.every((c) => c.transp && !c.trInconnu) && tStats.length === 1 && tStats[0] !== 'pas-lu' ? rows[0].transp : null;
    const ep = nombreEpingle(p);
    const prem = !premiere.has(p.cle); premiere.add(p.cle);
    const attrs = prem ? { 'data-relais-point': p.cle, 'data-relais-numero': p.numero, 'data-relais-point-arrives': p.nArrives, 'data-relais-point-comptes': p.nComptes, 'data-relais-point-attendus': p.nAttendus, 'data-relais-epingle-n': ep.n, 'data-relais-ville': (villeDuPoint(p) || {}).cle || '',
      'data-relais-repere': !avecCarte ? 'sans-carte' : repereDe(p, reperes) ? 'oui' : 'non', 'data-relais-pas-carte': avecCarte ? codePasSurCarte(p, reperes) : undefined, 'data-relais-urgent': p.urgent ? '1' : undefined } : { 'data-relais-point-suite': p.cle };
    return (
      <section key={cleSec + ':' + p.cle} className={'vrm-rpf-point' + (choisi === p.cle ? ' is-choisi' : '')} {...attrs}>
        <header className="vrm-rpf-tete">
          <span className="vrm-rpf-ident">
            <b className="vrm-rpf-nom" data-relais-nom="">{p.nom || p.adresseCourte || 'Point relais'}</b>
            {p.nom && (p.adresse || p.adresseCourte) ? <span className="vrm-rpf-adr" data-relais-adresse="">{p.adresse || p.adresseCourte}</span> : null}
          </span>
          <span className="vrm-rpf-meta">
            {tCommun ? <span className="vrm-rpf-transp" data-relais-transporteur={tCommun.cle || ''}><PastilleTransporteur t={tCommun} C={C} seul taille={18}/></span> : null}
            <span className="vrm-rpf-n" data-relais-compte={rows.length}>{plur(rows.length, 'colis', 'colis')}{(() => { const n = rows.filter((c) => !c.horsCompte && !(c.code || c.qr || c.code2)).length; return n && n < rows.length ? <span data-relais-sans-code={n}> · {n} code à venir</span> : null; })()}</span>
          </span>
        </header>
        <div className="vrm-rpf-liste">{rows.map((x) => ligne(x, !tCommun))}</div>
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
    <div className="vrm-rp vrm-rpf" ref={racine} data-retirer-ville={vChoisie ? vChoisie.cle : ''} data-retirer-sans-ville={sansVille.size} data-retirer-par-point={connus.length} data-retirer-comptes={vue ? vue.nComptes : 0} data-retirer-hors={vue ? vue.nHors : 0} data-retirer-sur-carte={surCarte.length} data-retirer-carte={avecCarte ? '1' : '0'}>
      {avecCarte && surCarte.length > 0 && etatFond !== 'ko' ? <div className="vrm-rpf-carte">
        <FondRelais points={surCarte} selection={choisi} onChoisir={choisir} C={C} hauteur={220} onEtat={setEtatFond} muet/>
        {/* Obligation de licence : l'attribution reste, en tout petit, DANS la carte. */}
        <span className="vrm-rpf-attrib" data-relais-note="">© OpenFreeMap · OpenMapTiles · OpenStreetMap</span>
      </div> : (avecCarte && surCarte.length > 0 ? <FondRelais points={surCarte} selection={choisi} onChoisir={choisir} C={C} hauteur={220} onEtat={setEtatFond} muet/> : null)}
      {villes.length ? <div className="vrm-rpf-villes vrm-seg" role="group" aria-label="Choisir une ville" data-retirer-villes={villes.length}>
        <button type="button" className="vrm-seg-btn" aria-pressed={!vChoisie} data-ville="" onClick={() => onVille && onVille('')}>Toutes</button>
        {villes.map((v) => <button key={v.cle} type="button" className="vrm-seg-btn" aria-pressed={!!vChoisie && vChoisie.cle === v.cle} data-ville={v.cle} data-ville-n={v.n} onClick={() => onVille && onVille(v.cle)}>{v.nom} <span className="vrm-seg-n">{v.n}</span></button>)}
      </div> : null}
      {section('aujourdhui', 'À retirer aujourd’hui', parSection.aujourdhui, { ambre: true })}
      {/* (5 nov.) Un point y est entier : s'il porte un colis au code à venir, la section dit « À retirer ». */}
      {section('prets', parSection.prets.every(({ x }) => x.code || x.qr || x.code2) ? 'Prêts à retirer' : 'À retirer', parSection.prets)}
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
          <summary className="vrm-rpf-section-titre is-repli"><span>Peut-être en double<span className="vrm-rpf-section-n">{parSection.double.length}</span></span><span className="vrm-rpf-chevron" aria-hidden="true">›</span></summary>
          {/* (6 nov.) Pourquoi « peut-être en double » : une phrase, une fois (src/retraitPreuves.js). */}
          <p className="vrm-rp-sous vrm-rpf-double-pourquoi" data-double-explication={parSection.double.length}>{explicationEnDouble(parSection.double.length)}</p>
          <div className="vrm-rpf-section-corps"><section className="vrm-rpf-point"><div className="vrm-rpf-liste">{parSection.double.map(({ x }) => ligne(x))}</div></section></div>
        </details>) : null}
      {nRoute ? (
        <details className="vrm-rpf-section is-repli vrm-rpf-route" data-rp-section="route" data-rp-section-n={nRoute} data-retirer-en-route-sans={routeSans.length}>
          <summary className="vrm-rpf-section-titre is-repli"><span>En route<span className="vrm-rpf-section-n">{nRoute}</span></span><span className="vrm-rpf-chevron" aria-hidden="true">›</span></summary>
          <div className="vrm-rpf-section-corps"><section className="vrm-rpf-point"><div className="vrm-rpf-liste" data-en-route-liste={nRoute}>
            {attendus.map(({ c, p }) => (
              <div key={c.id} className="vrm-rpf-ligne is-attendu" data-relais-attendu={c.id} data-relais-estimee={c.estimee || ''} data-en-route-achat={c.id}>
                <div className="vrm-rpf-rang"><span className="vrm-rpf-vignette is-sans" aria-hidden="true"/><span className="vrm-rpf-quoi"><span className="vrm-rpf-titre">{c.titre || 'Achat'}</span><span className="vrm-rpf-puces"><span className="vrm-rpf-puce">{p.nom || 'Point relais'}</span>{c.estimee ? <span className="vrm-rpf-puce">vers le {jourFr(c.estimee)}</span> : null}</span></span></div>
              </div>))}
            {routeSans.map((a) => (
              <div key={a.id} className="vrm-rpf-ligne is-attendu" data-en-route-achat={a.id}><div className="vrm-rpf-rang">
                <span className={'vrm-rpf-vignette' + (a.photo && Photo ? '' : ' is-sans')} aria-hidden="true">{a.photo && Photo ? Photo(a.photo) : null}</span>
                <span className="vrm-rpf-quoi"><span className="vrm-rpf-titre">{a.titre || 'Achat'}</span><span className="vrm-rpf-puces"><span className="vrm-rpf-puce">en route</span></span></span>
              </div></div>))}
          </div></section></div>
        </details>) : null}
    </div>
  );
}

export function ColonneRetirer({ vue, C, Photo, gestes = null, detail = null, nomTransporteur = null, avecCarte = true, enRouteSansRelais = 0, fusion = false, echeance = null, statut = null, retirer = null, ville = '', onVille = null, titreDe = null, enRoute = [] }) {
  if (fusion) return <ColonneRetirerF vue={vue} C={C} Photo={Photo} gestes={gestes} detail={detail} avecCarte={avecCarte} echeance={echeance} statut={statut} retirer={retirer} ville={ville} onVille={onVille} titreDe={titreDe} enRoute={enRoute}/>;
  const points = (vue && vue.points) || [];
  const connus = points.filter((p) => !p.inconnu);
  const inconnu = points.find((p) => p.inconnu) || null;
  // Au téléphone (pas de carte) : aucune adresse n'est cherchée pour la carte.
  const reperes = useReperes(connus, avecCarte && connus.length > 0);
  const [choisi, setChoisi] = React.useState('');
  const [etatFond, setEtatFond] = React.useState('charge');
  const racine = React.useRef(null);
  const surCarte = avecCarte ? connus.map((p) => { const r = repereDe(p, reperes); return r ? { ...p, lat: r.lat, lon: r.lon } : null; }).filter(Boolean) : [];
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
                  : (trNom && !tParCarte ? <span className="vrm-rp-adresse" data-relais-transporteur={trCode}>{trNom}</span> : null)}
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
            <span className="vrm-rp-ident">
              <b className="vrm-rp-nom">À vérifier · {aVerifier.length}</b>
              {(() => { const n = aVerifier.filter((c) => c.trInconnu).length; return n ? <span className="vrm-rp-adresse" data-transp="transporteur-inconnu" data-transp-n={n}>Transporteur pas encore connu{n > 1 ? ` pour ${n} colis` : ''} : le suivi Vinted ne le nomme pas</span> : null; })()}
              {(() => { const n = aVerifier.filter((c) => String(c.cle || '').startsWith('r:c:')).length; return n ? <span className="vrm-rp-resume" data-en-verification={n}>{n > 1 ? `${n} achats en cours de vérification` : '1 achat en cours de vérification'} : Vinted {n > 1 ? 'les dit' : 'le dit'} au point relais, mais rien ne {n > 1 ? 'les' : 'le'} relie encore à un colis ci-dessus — peut-être le même. Hors du compte.</span> : null; })()}
              <span className="vrm-rp-resume">{raisonCommune ? `${raisonCommune[0].toUpperCase()}${raisonCommune.slice(1)}. ` : ''}Hors du compte « à retirer » : regarde le suivi, et touche « J’ai retiré » si tu l’as eu.{(() => { const n = aVerifier.filter((c) => c.encoreCode || c.code || c.qr).length; return n ? ` ${n > 1 ? `${n} ont encore leur code ou leur QR` : '1 a encore son code ou son QR'} : peut-être encore au relais.` : ''; })()}</span>
            </span>
          </header>
          <div className="vrm-rp-liste">
            {aVerifier.map((x, i) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} gestes={gestes} detail={detail} avecLieu raison={raisonCommune ? '' : raisons[i]} C={C} avecTransporteur={!x.trInconnu}/>)}
          </div>
        </section>
      )}
      {carteVisible && <p className="vrm-rp-note vrm-rp-attrib" data-relais-note="">Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : Vinted, adresse.data.gouv.fr.</p>}
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
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.text }}>Par point relais</span>
          <span style={{ display: 'block', ...muted }}>{groupes.length ? `${groupes.length} point${groupes.length > 1 ? 's' : ''} · ${nArr} déjà arrivé${nArr > 1 ? 's' : ''}${nAtt ? ` · ${nAtt} attendu${nAtt > 1 ? 's' : ''}` : ''}` : 'Aucune destination encore connue'}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 16, color: C.muted }}>{ouverte ? '▴' : '▾'}</span>
      </button>
      {ouverte && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {avecRepere.length > 0 && <FondRelais points={avecRepere} selection={choisi} onChoisir={setChoisi} C={C} etiquette={(g) => g.nArrives + g.nAttendus}/>}
          {groupes.map((g) => {
            const er = etatRepere(g);
            return (
              <div key={g.cle} data-relais-point={g.cle} data-relais-point-arrives={g.nArrives} data-relais-point-attendus={g.nAttendus} data-relais-repere={er}
                style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, outline: choisi === g.cle ? `2px solid ${C.accent}` : 'none', outlineOffset: 2, borderRadius: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{nomDe(g)}</div>
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
            Un colis n'est rangé sous un point que par ce qui le désigne lui (l'e-mail du transporteur, la conversation, ou le suivi Vinted de CET achat) — jamais deviné.
            {sansRelais > 0 ? ` ${sansRelais} achat${sansRelais > 1 ? 's' : ''} en route sans destination connue : elle ne vient que du suivi Vinted de l'achat, quand il la donne (l'extension le relit en passant).` : ''}
            {' '}Les arrivées sont celles que Vinted estime, pas une promesse. Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : adresse.data.gouv.fr.
          </div>
        </div>
      )}
    </div>
  );
}
