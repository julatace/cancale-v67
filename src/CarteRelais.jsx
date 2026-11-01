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
  if (c && c.lat != null) return { lat: c.lat, lon: c.lon };
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
  const c2 = lireCache(); c2[k] = sur ? { lat: res.lat, lon: res.lon } : { echec: Date.now(), raison: (res && res.echec) || 'introuvable' }; ecrireCache(c2);
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
  if (p.sansCarte) return 'adresse';
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
export function FondRelais({ points, selection, onChoisir, C, etiquette, hauteur = 260, onEtat }) {
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
            const k = dec[i];
            marqueurs.push(new ml.Marker({ element: el, anchor: 'bottom', offset: [k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 38 : 0, 0] }).setLngLat([p.lon, p.lat]).addTo(carte));
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
      <div ref={boite} data-relais-fond={etat} className="vrm-relais-fond" aria-hidden={ko ? 'true' : undefined}
        style={{ width: '100%', height: hauteur, borderRadius: 10, overflow: 'hidden', background: '#eaeef2', ...(ko ? { position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' } : null) }}/>
      {ko && <div data-relais-carte-ko="" style={{ fontSize: 12, color: 'var(--vrm-muted, #667)', padding: '8px 0' }}>La carte ne s’affiche pas ici pour l’instant — la liste ci-dessous reste juste.</div>}
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

// ── LA COLONNE « À RETIRER », PAR POINT (1er nov.) ──────────────────────────
const plur = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const texteLimite = (j) => (j == null ? '' : j < 0 ? 'date limite passée' : j === 0 ? 'dernier jour aujourd’hui' : j === 1 ? 'dernier jour demain' : `encore ${j} jours`);

function CarteColisRetirer({ x, Photo, onOuvrir, limiteSurCarte }) {
  const codeTxt = x.code ? x.code : x.qr ? 'QR code' : '';
  const corps = (
    <>
      <span className="vrm-cc-haut">
        <span className="vrm-cc-photo" aria-hidden="true">{(x.photo && Photo && Photo(x.photo)) || <span className="vrm-cc-photo-vide"/>}</span>
        <span className="vrm-cc-nom" title={x.titre}>{x.titre}</span>
        {x.num ? <span className="vrm-cc-num" data-numero={x.num}>N°{x.num}</span> : null}
      </span>
      <span className="vrm-rp-code-ligne">
        {codeTxt
          ? <span className="vrm-rp-code" data-code-retrait={x.code || ''}>{codeTxt}{x.code2 ? <span className="vrm-rp-code2"> · {x.code2}</span> : null}</span>
          : <span className="vrm-rp-sans-code">{x.horsCompte ? '' : 'code pas encore lu'}</span>}
        {x.aVerifier
          ? <span className="vrm-cc-etat" data-a-verifier-txt="">à vérifier : délai dépassé ou incident</span>
          : (limiteSurCarte && x.jours != null ? <span className={'vrm-cc-etat' + (x.jours <= 1 ? ' is-ambre' : '')}>{texteLimite(x.jours)}</span> : null)}
      </span>
      {x.sansLieu ? <span className="vrm-rp-raison" data-sans-lieu-raison=""><span>{x.sansLieu.raison}</span> <span className="vrm-rp-geste">{x.sansLieu.geste}</span></span> : null}
    </>
  );
  const attrs = { 'data-cc-carte': x.cle, 'data-cc-dans': 'retirer', 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined, 'data-hors-compte': x.horsCompte ? '1' : undefined, 'data-sans-lieu': x.sansLieu ? '1' : undefined };
  return onOuvrir && x.ouvrir
    ? <button type="button" className="vrm-cc-carte vrm-rp-carte" {...attrs} onClick={() => onOuvrir(x)}>{corps}</button>
    : <div className="vrm-cc-carte vrm-rp-carte" {...attrs}>{corps}</div>;
}

export function ColonneRetirer({ vue, C, Photo, onOuvrir, enRouteSansRelais = 0 }) {
  const points = (vue && vue.points) || [];
  const connus = points.filter((p) => !p.inconnu);
  const inconnu = points.find((p) => p.inconnu) || null;
  const reperes = useReperes(connus, connus.length > 0);
  const [choisi, setChoisi] = React.useState('');
  const [etatFond, setEtatFond] = React.useState('charge');
  const racine = React.useRef(null);
  const surCarte = connus.map((p) => { const r = repereDe(p, reperes); return r ? { ...p, lat: r.lat, lon: r.lon } : null; }).filter(Boolean);
  const choisir = (cle) => {
    setChoisi(cle);
    const el = racine.current && [...racine.current.querySelectorAll('[data-relais-point]')].find((e) => e.getAttribute('data-relais-point') === cle);
    if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { el.scrollIntoView(); } }
  };
  const raisonCarte = (p) => raisonPasSurCarte(p, reperes) || null;
  if (!points.length && !enRouteSansRelais) return null;
  return (
    <div className="vrm-rp" ref={racine} data-retirer-par-point={connus.length} data-retirer-comptes={vue ? vue.nComptes : 0} data-retirer-hors={vue ? vue.nHors : 0} data-retirer-sur-carte={surCarte.length}>
      {surCarte.length > 0 && <FondRelais points={surCarte} selection={choisi} onChoisir={choisir} C={C} hauteur={200} onEtat={setEtatFond}/>}
      {connus.length > 0 && surCarte.length < connus.length && etatFond !== 'ko' && (
        <p className="vrm-rp-note" data-retirer-pas-carte={connus.length - surCarte.length}>
          {surCarte.length ? `${plur(surCarte.length, 'point')} sur la carte · ${connus.length - surCarte.length} pas sur la carte (la raison est sous chacun).` : `Aucun point sur la carte pour l’instant (la raison est sous chacun).`}
        </p>
      )}
      {connus.map((p) => {
        const comptes = p.arrives.filter((c) => !c.horsCompte);
        const hors = p.arrives.filter((c) => c.horsCompte);
        // La date limite d'un colis ne s'écrit sur SA carte que si les colis du
        // point n'ont pas la même (sinon c'est la phrase de l'en-tête, §7).
        const jMixte = new Set(comptes.map((c) => c.jours).filter((j) => j != null)).size > 1;
        const raison = raisonCarte(p);
        const lim = texteLimite(p.prochaineLimite);
        // (1er nov.) La pastille du point = son épingle : le MÊME nombre, de la
        // même fonction (`nombreEpingle`) ; le résumé ne le réécrit pas (§7).
        const ep = nombreEpingle(p);
        const morceaux = [
          p.nComptes || (!p.nAttendus && !hors.length) ? { k: 'aretirer', t: ep.sorte === 'aretirer' ? 'colis à retirer' : plur(p.nComptes, 'colis à retirer', 'colis à retirer') } : null,
          hors.length ? { k: 'averifier', t: ep.sorte === 'averifier' ? 'à vérifier' : `${hors.length} à vérifier` } : null,
          p.nAttendus ? { k: 'enroute', t: ep.sorte === 'enroute' ? 'en route' : `${p.nAttendus} en route` } : null,
        ].filter(Boolean);
        return (
          <section key={p.cle} className={'vrm-rp-point' + (choisi === p.cle ? ' is-choisi' : '')} data-relais-point={p.cle} data-relais-numero={p.numero}
            data-relais-point-arrives={p.nArrives} data-relais-point-comptes={p.nComptes} data-relais-point-attendus={p.nAttendus} data-relais-epingle-n={ep.n}
            data-relais-repere={repereDe(p, reperes) ? 'oui' : (raison && raison !== EN_COURS ? 'non' : 'cherche')} data-relais-urgent={p.urgent ? '1' : undefined}>
            <header className="vrm-rp-tete">
              <span className={'vrm-rp-numero vrm-rp-compte' + (ep.sorte === 'aretirer' && repereDe(p, reperes) ? ' is-fort' : '')} data-relais-pastille={ep.n} aria-hidden="true">{ep.n}</span>
              <span className="vrm-rp-ident">
                <b className="vrm-rp-nom" data-relais-nom="">{p.nom || p.adresseCourte || 'Point relais'}</b>
                {p.nom && p.adresseCourte ? <span className="vrm-rp-adresse" data-relais-adresse="">{p.adresseCourte}</span> : null}
                {!p.nom ? <span className="vrm-rp-adresse">nom du point pas écrit dans le message</span> : null}
                <span className="vrm-rp-resume">
                  <span className="vrm-sr">{ep.n} </span>
                  {morceaux.map((m, i) => <span key={m.k} data-relais-compte={m.k === 'aretirer' ? p.nComptes : undefined}>{i ? ' · ' : ''}{m.t}</span>)}
                  {lim ? <span className={p.urgent ? 'is-ambre' : ''} data-relais-limite={p.prochaineLimite}> · {lim}</span> : null}
                </span>
                {raison ? <span className="vrm-rp-pas-carte" data-relais-sans-repere="" data-raison={codePasSurCarte(p, reperes)}>Pas sur la carte : {raison}.</span> : null}
              </span>
            </header>
            <div className="vrm-rp-liste">
              {comptes.map((x) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} onOuvrir={onOuvrir} limiteSurCarte={jMixte}/>)}
              {hors.map((x) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} onOuvrir={onOuvrir}/>)}
              {p.attendus.map((c) => (
                <div key={c.id} className="vrm-rp-attendu" data-relais-attendu={c.id} data-relais-estimee={c.estimee || ''}>
                  En route{c.titre ? ` · ${c.titre}` : ''} — {c.estimee ? <>arrivée estimée {jourFr(c.estimee)}</> : <span>date d’arrivée pas encore dite</span>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {inconnu && (
        <section className="vrm-rp-point vrm-rp-inconnu" data-relais-point={inconnu.cle} data-relais-point-arrives={inconnu.nArrives} data-relais-point-comptes={inconnu.nComptes}>
          <header className="vrm-rp-tete">
            <span className="vrm-rp-numero is-vide" aria-hidden="true">?</span>
            <span className="vrm-rp-ident">
              <b className="vrm-rp-nom">Point pas encore connu</b>
              <span className="vrm-rp-resume">{plur(inconnu.nComptes, 'colis', 'colis')}{inconnu.nArrives - inconnu.nComptes ? ` · ${inconnu.nArrives - inconnu.nComptes} à vérifier` : ''} — le message reçu ne dit pas encore où il est</span>
            </span>
          </header>
          <div className="vrm-rp-liste">
            {inconnu.arrives.map((x) => <CarteColisRetirer key={x.cle || x.id} x={x} Photo={Photo} onOuvrir={onOuvrir}/>)}
          </div>
        </section>
      )}
      {enRouteSansRelais > 0 && <p className="vrm-rp-note" data-retirer-en-route-sans={enRouteSansRelais}>{plur(enRouteSansRelais, 'achat')} en route dont Vinted ne dit pas encore le point d’arrivée.</p>}
      {surCarte.length > 0 && etatFond !== 'ko' && <p className="vrm-rp-note vrm-rp-attrib" data-relais-note="">Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : Vinted, Base Adresse Nationale.</p>}
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
      {avecRepere.length > 0 && <div data-relais-note="" style={{ ...muted, fontSize: 10.5 }}>Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : Base Adresse Nationale.</div>}
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
            {' '}Les arrivées sont celles que Vinted estime, pas une promesse. Fond : OpenFreeMap · © OpenMapTiles · © OpenStreetMap ; adresses : Base Adresse Nationale.
          </div>
        </div>
      )}
    </div>
  );
}
