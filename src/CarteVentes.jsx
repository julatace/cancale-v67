// ════════════════════════════════════════════════════════════════════════════
//  CARTE DE TES VENTES — Argent (14 nov., frais-carte, proposition 124 choisie par
//  Julien : « où partent tes paires », « tu peux même faire du monde »).
//  · La règle : `lieuxVentes` (src/lieuxVentes.js) — les ventes FAITES placées par
//    IDENTITÉ (pays du profil Vinted par la transaction, ville de livraison eBay par
//    la commande), agrégées par pays, et en France par ville (ou département tant que
//    la ville n'est pas placée). Aucun nom, aucune adresse, aucun pseudo n'arrive ici.
//  · Le fond : OpenFreeMap + MapLibre (src/fondCarte.js, celui de la carte des points
//    relais — un seul domaine de tuiles, déjà dans la CSP), chargé seulement quand la
//    carte entre à l'écran. Les bulles sont posées AVANT le fond : la carte « s'ouvre »
//    sans attendre les tuiles. Pas de WebGL / fond injoignable ⇒ la liste reste juste.
//  · Les villes : AUCUN géocodage par vente. Une recherche par VILLE (nom + code
//    postal, jamais une rue) à la Base Adresse Nationale (api-adresse.data.gouv.fr,
//    gratuite, déjà dans la CSP), seulement en vue France, une à la fois, 40 au plus
//    par ouverture, gardée dans CE navigateur (`vrm_geo_villes_v1`, une commodité).
//    Nominatim n'est jamais appelé (pas de requêtes en masse).
//  Aucun import d'App.jsx : ventes, pays, commandes eBay et relevé arrivent en props.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lieuxVentes, rayonBulle } from './lieuxVentes.js';
import { departementDuCp } from './lieuxTables.js';
import { SegmenteBase } from './composants/Bouton.jsx';
import { tr, monnaie, date as dateLoc, localeCourante } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import './frais-carte.css';

const NOMS_SITES = { Vinted: 'Vinted', eBay: 'eBay', Vestiaire: 'Vestiaire', Leboncoin: 'Leboncoin', Ailleurs: '—' };
const eurC = (c) => (c == null ? '—' : monnaie(c / 100, 'EUR', c % 100 ? undefined : { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const nomPays = (cc) => { try { const n = new Intl.DisplayNames([localeCourante()], { type: 'region' }).of(cc); if (n && n !== cc) return n; } catch (_) {} return cc; };
export const nomLieu = (b) => (!b ? '' : b.niveau === 'ville' ? b.ville : b.niveau === 'departement' ? tr('fc.departement', { dep: b.dep }) : nomPays(b.pays));
const CLE_VUE = 'vrm_carte_ventes_vue';
const lireLocal = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
const ecrireLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const FRANCE = [[-5.4, 41.2], [9.8, 51.2]];

// ── Les repères des villes : une recherche par ville, gardée ────────────────
const CACHE_GEO = 'vrm_geo_villes_v1';
const ECHEC_GEO_MS = 30 * 86400e3;
const lireGeo = () => { try { return JSON.parse(localStorage.getItem(CACHE_GEO) || '{}') || {}; } catch (_) { return {}; } };
function useVillesPlacees(aPlacer, actif) {
  const [geo, setGeo] = React.useState(lireGeo);
  const cle = aPlacer.map((v) => v.cle).join('|');
  React.useEffect(() => {
    if (!actif || !aPlacer.length || typeof fetch !== 'function') return undefined;
    let vivant = true;
    const maintenant = Date.now();
    const file = aPlacer.filter((v) => { const g = geo[v.cle]; return !g || (g.echec && maintenant - g.at > ECHEC_GEO_MS); }).slice(0, 40);
    (async () => {
      for (const v of file) {
        if (!vivant) return;
        let note = null;
        try {
          const u = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(v.ville)}${/^\d{5}$/.test(v.cp) ? `&postcode=${v.cp}` : ''}&type=municipality&limit=1`;
          const r = await fetch(u, { credentials: 'omit' });
          if (r.ok) {
            const j = await r.json();
            const f = j && Array.isArray(j.features) ? j.features[0] : null;
            const p = f && f.properties, c = f && f.geometry && f.geometry.coordinates;
            const sur = p && Array.isArray(c) && Number(p.score) >= 0.5 && departementDuCp(p.postcode) === v.dep;
            note = sur ? { lat: Number(c[1]), lon: Number(c[0]), at: Date.now() } : { echec: 1, at: Date.now() };
          }
        } catch (_) { note = null; }                       // panne de réseau : rien n'est noté, réessayé plus tard
        if (!vivant) return;
        if (note) {
          const tout = { ...lireGeo(), [v.cle]: note };
          try { localStorage.setItem(CACHE_GEO, JSON.stringify(tout)); } catch (_) {}
          setGeo(tout);
        }
        await new Promise((ok) => setTimeout(ok, 250));
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle]);
  return React.useCallback((k) => { const g = geo[k]; return g && g.lat != null ? g : null; }, [geo]);
}

const PERIODES = (an) => [
  { v: '12m', l: tr('fc.douzeMois') },
  { v: String(an), l: String(an) },
  { v: String(an - 1), l: String(an - 1) },
  { v: 'tout', l: tr('fc.tout') },
];
const bornes = (p, maintenant) => {
  if (p === 'tout') return { de: -Infinity, a: Infinity };
  if (p === '12m') { const d = new Date(maintenant); d.setFullYear(d.getFullYear() - 1); return { de: d.getTime(), a: Infinity }; }
  const y = Number(p); return { de: new Date(y, 0, 1).getTime(), a: new Date(y + 1, 0, 1).getTime() };
};

export default function CarteVentes({ lignes, paysVinted, ebay, releve, maintenant: tFourni = null, sombre = false }) {
  useLangue();
  const [maintenant] = React.useState(() => tFourni || Date.now());
  const an = new Date(maintenant).getFullYear();
  const [vue, setVueEtat] = React.useState(() => (lireLocal(CLE_VUE, 'monde') === 'france' ? 'france' : 'monde'));
  const setVue = (v) => { setVueEtat(v); setChoisi(null); ecrireLocal(CLE_VUE, v); };
  const [periode, setPeriode] = React.useState('12m');
  const [plateforme, setPlateforme] = React.useState('tout');
  const [choisi, setChoisi] = React.useState(null);
  const [tousLieux, setTousLieux] = React.useState(false);
  const b = React.useMemo(() => bornes(periode, maintenant), [periode, maintenant]);
  // Une première passe sans repères de villes, pour savoir lesquelles placer.
  const base = React.useMemo(() => lieuxVentes({ lignes, paysVinted, ebay, releve, de: b.de, a: b.a, plateforme }), [lignes, paysVinted, ebay, releve, b, plateforme]);
  const coordVille = useVillesPlacees(base.villesAPlacer || [], vue === 'france');
  const L = React.useMemo(() => lieuxVentes({ lignes, paysVinted, ebay, releve, de: b.de, a: b.a, plateforme, coordVille }), [lignes, paysVinted, ebay, releve, b, plateforme, coordVille]);
  const bulles = L.etat !== 'lu' ? [] : (vue === 'monde' ? L.pays : L.france);
  const surCarte = bulles.filter((x) => !x.horsCarte && Number.isFinite(x.lat));
  const sel = choisi ? bulles.find((x) => x.cle === choisi) || null : null;

  const tete = (
    <div className="vrm-fc-tete">
      <h2 className="vrm-fc-titre" data-titre-section="">{tr('fc.carteTitre')}</h2>
      <SegmenteBase label={tr('fc.vue')} className="vrm-fc-seg" value={vue} onChange={setVue}
        options={[{ v: 'monde', l: tr('fc.monde'), data: { 'data-cv-vue-choix': 'monde' } }, { v: 'france', l: tr('fc.france'), data: { 'data-cv-vue-choix': 'france' } }]}/>
    </div>
  );
  if (L.etat !== 'lu') return (
    <section className="vrm-cv" data-carte-ventes={L.etat}>
      {tete}
      <p className="vrm-fc-ligne-vide">{L.etat === 'passu' ? tr('fc.passu') : tr('fc.lecture')}</p>
    </section>
  );
  const filtres = (
    <div className="vrm-cv-filtres">
      <SegmenteBase label={tr('fc.periode')} className="vrm-fc-seg" value={periode} onChange={(v) => { setPeriode(v); setChoisi(null); }}
        options={PERIODES(an).map((o) => ({ ...o, data: { 'data-cv-periode': o.v } }))}/>
      {L.plateformes.length > 1 || plateforme !== 'tout' ? (
        <SegmenteBase label={tr('fc.plateforme')} className="vrm-fc-seg" value={plateforme} onChange={(v) => { setPlateforme(v); setChoisi(null); }}
          options={[{ v: 'tout', l: tr('fc.toutes'), data: { 'data-cv-plateforme': 'tout' } }, ...L.plateformes.map((p) => ({ v: p, l: NOMS_SITES[p] || p, data: { 'data-cv-plateforme': p } }))]}/>
      ) : null}
    </div>
  );
  const resume = [tr('fc.nVentes', { n: L.n }), L.sansLieu.n ? tr('fc.sansLieu', { n: L.sansLieu.n }) : '', vue === 'france' && L.franceSansVille.n ? tr('fc.franceSansVille', { n: L.franceSansVille.n }) : ''].filter(Boolean).join(' · ');
  const max = surCarte.reduce((m, x) => Math.max(m, x.n), 0);
  const liste = tousLieux ? bulles : bulles.slice(0, 6);
  return (
    <section className="vrm-cv" data-carte-ventes="lu" data-cv-vue={vue} data-cv-n={String(L.n)} data-cv-sans-lieu={String(L.sansLieu.n)}
      data-cv-france-sans-ville={String(L.franceSansVille.n)} data-cv-bulles={String(surCarte.length)}>
      {tete}
      <p className="vrm-cv-resume" data-cv-resume="">{resume}{L.paysEnCours ? ` · ${tr('fc.paysEnCours')}` : ''}</p>
      {filtres}
      {!L.n ? <p className="vrm-fc-ligne-vide" data-cv-vide="">{tr('fc.aucuneVente')}</p> : !bulles.length ? <p className="vrm-fc-ligne-vide" data-cv-vide="">{tr('fc.aucunLieu')}</p> : (
        <>
          <FondVentes bulles={surCarte} max={max} vue={vue} choisi={choisi} onChoisir={(k) => setChoisi(k === choisi ? null : k)} sombre={sombre}/>
          {sel ? <DetailLieu b={sel} onFermer={() => setChoisi(null)}/> : (
            <div className="vrm-fc-groupe">
              <div className="vrm-fc-entete">{tr('fc.lieux')}</div>
              <div className="vrm-fc-carte" role="list">
                {liste.map((x) => (
                  <button key={x.cle} type="button" role="listitem" className="vrm-fc-rangee vrm-cv-lieu" data-cv-lieu={x.cle} data-cv-lieu-n={String(x.n)} data-cv-lieu-c={String(x.c)} onClick={() => setChoisi(x.cle)}>
                    <span className="vrm-cv-point" aria-hidden="true" style={{ '--r': `${Math.max(8, Math.round(rayonBulle(x.n, max || x.n, { min: 8, maxi: 18 })))}px` }}/>
                    <span className="vrm-fc-nom">
                      <span className="vrm-fc-nom-t">{nomLieu(x)}</span>
                      <span className="vrm-fc-nom-s">{tr('fc.nVentes', { n: x.n })}{x.horsCarte ? ` · ${tr('fc.horsCarte')}` : ''}{x.niveau === 'departement' && x.villes.length ? ` · ${tr('fc.villesAPlacer', { n: x.villes.length })}` : ''}</span>
                    </span>
                    <span className="vrm-fc-val">{eurC(x.c)}</span>
                    <span className="vrm-fc-chevron" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
              {bulles.length > 6 ? <button type="button" className="vrm-fc-repli" data-cv-tous="" onClick={() => setTousLieux(!tousLieux)}>{tousLieux ? tr('fc.fermer') : tr('fc.voirLieux', { n: bulles.length })}</button> : null}
            </div>
          )}
        </>
      )}
      <SansLieu L={L}/>
    </section>
  );
}

function SansLieu({ L }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <>
      <button type="button" className="vrm-fc-repli" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)} data-cv-comment="">
        {tr('fc.comment')} <span aria-hidden="true" className="vrm-fc-chev">{ouvert ? '⌃' : '⌄'}</span>
      </button>
      {ouvert ? (
        <div className="vrm-fc-expl" data-cv-expl="">
          <p>{tr('fc.sources')}</p>
          {Object.entries(L.sansLieu.par).map(([p, x]) => <p key={p} data-cv-sans-lieu-site={p} data-cv-sans-lieu-n={String(x.n)}>{NOMS_SITES[p] || p} · {tr('fc.sansLieu', { n: x.n })} · {tr('fc.raison.' + x.raison)}</p>)}
        </div>
      ) : null}
    </>
  );
}

function DetailLieu({ b, onFermer }) {
  const [n, setN] = React.useState(30);
  const v = b.ventes.slice(0, n);
  return (
    <div className="vrm-fc-groupe" data-cv-detail={b.cle} data-cv-detail-n={String(b.n)} data-cv-detail-c={String(b.c)}>
      <div className="vrm-cv-detail-tete">
        <div>
          <div className="vrm-cv-detail-nom">{nomLieu(b)}</div>
          <div className="vrm-fc-nom-s">{tr('fc.nVentes', { n: b.n })} · {eurC(b.c)}{b.niveau === 'departement' && b.villes.length ? ` · ${b.villes.slice(0, 4).map((x) => x.ville).join(', ')}${b.villes.length > 4 ? '…' : ''}` : ''}</div>
        </div>
        <button type="button" className="vrm-fc-fermer" onClick={onFermer} data-cv-fermer="">{tr('fc.fermer')}</button>
      </div>
      <div className="vrm-fc-carte" role="list" data-cv-ventes="">
        {v.map((x, i) => (
          <div key={i} role="listitem" className="vrm-fc-rangee vrm-cv-vente" data-cv-vente-num={x.num || ''}>
            <span className={'vrm-cv-num' + (x.num ? '' : ' is-vide')}>{x.num ? `N°${x.num}` : tr('fc.sansNum')}</span>
            <span className="vrm-fc-nom"><span className="vrm-fc-nom-t vrm-cv-date">{dateLoc(x.ts, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="vrm-fc-nom-s">{NOMS_SITES[x.plateforme] || x.plateforme}</span></span>
            <span className="vrm-fc-val">{eurC(x.c)}</span>
          </div>
        ))}
      </div>
      {b.ventes.length > n ? <button type="button" className="vrm-fc-repli" data-cv-plus="" onClick={() => setN(n + 100)}>{tr('fc.voirPlus', { n: Math.min(100, b.ventes.length - n) })}</button> : null}
    </div>
  );
}

// ── Le fond et ses bulles ───────────────────────────────────────────────────
const tactile = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (_) { return false; } };
const mac = () => { try { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''); } catch (_) { return false; } };
function cadrer(carte, vue, bulles, anime) {
  try {
    const opts = { padding: 36, duration: anime ? 450 : 0, maxZoom: vue === 'france' ? 8 : 4 };
    if (vue === 'france') { carte.fitBounds(FRANCE, opts); return; }
    if (!bulles.length) { carte.jumpTo({ center: [10, 35], zoom: 0.8 }); return; }
    const lons = bulles.map((x) => x.lon), lats = bulles.map((x) => x.lat);
    const bb = [[Math.min(...lons) - 3, Math.min(...lats) - 3], [Math.max(...lons) + 3, Math.max(...lats) + 3]];
    carte.fitBounds(bb, opts);
  } catch (_) {}
}
function FondVentes({ bulles, max, vue, choisi, onChoisir, sombre }) {
  const boite = React.useRef(null);
  const carteRef = React.useRef(null);
  const mlRef = React.useRef(null);
  const marqueurs = React.useRef([]);
  const [etat, setEtat] = React.useState('attente');   // attente · charge · bulles · pret · ko
  const [visible, setVisible] = React.useState(false);
  const rappel = React.useRef(onChoisir); rappel.current = onChoisir;
  // Rien ne charge tant que la carte n'entre pas à l'écran.
  React.useEffect(() => {
    const el = boite.current; if (!el) return undefined;
    if (typeof IntersectionObserver !== 'function') { setVisible(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!visible) return undefined;
    let vivant = true, carte = null;
    setEtat('charge');
    import('./fondCarte.js').then((f) => {
      if (!f.webglDispo()) throw new Error('webgl');
      return f.chargerMaplibre().then((ml) => {
        if (!vivant || !boite.current) return;
        mlRef.current = ml;
        const coop = tactile();
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [10, 35], zoom: 1, attributionControl: false,
          dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false,
          ...(coop ? { cooperativeGestures: true, locale: { 'CooperativeGesturesHandler.WindowsHelpText': tr('fc.ctrlZoom'), 'CooperativeGesturesHandler.MacHelpText': tr('fc.cmdZoom'), 'CooperativeGesturesHandler.MobileHelpText': tr('fc.deuxDoigts') } } : {}) });
        try { carte.touchZoomRotate && carte.touchZoomRotate.disableRotation(); } catch (_) {}
        carteRef.current = carte;
        carte.once('load', () => {
          if (!vivant) return;
          try { carte.resize(); } catch (_) {}
          setEtat('bulles');
          f.poserFond(carte, { sombre, annule: () => !vivant }).then((r) => {
            if (!vivant) return;
            try { carte.addControl(new ml.AttributionControl({ compact: true, ...(r && r.attribution ? { customAttribution: r.attribution } : {}) })); } catch (_) {}
            setEtat('pret');
          }).catch(() => { if (vivant) setEtat('ko'); });
        });
      });
    }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; carteRef.current = null; for (const m of marqueurs.current) { try { m.remove(); } catch (_) {} } marqueurs.current = []; if (carte) { try { carte.remove(); } catch (_) {} } };
  }, [visible, sombre]);
  // Les bulles : refaites quand les lieux changent ; posées dès que la carte vide est chargée.
  const cleBulles = bulles.map((x) => `${x.cle}:${x.n}:${x.lat}:${x.lon}`).join('|');
  const pose = etat === 'bulles' || etat === 'pret';
  React.useEffect(() => {
    const carte = carteRef.current, ml = mlRef.current;
    if (!pose || !carte || !ml) return;
    for (const m of marqueurs.current) { try { m.remove(); } catch (_) {} }
    marqueurs.current = [];
    // Les plus petites au-dessus : une grosse bulle ne cache jamais une petite.
    [...bulles].sort((x, y) => y.n - x.n).slice(0, 400).forEach((x) => {
      const r = rayonBulle(x.n, max);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'vrm-cv-bulle';
      el.setAttribute('data-cv-bulle', x.cle);
      el.setAttribute('data-cv-bulle-n', String(x.n));
      if (x.approx) el.setAttribute('data-cv-approx', '');
      el.setAttribute('aria-label', tr('fc.bulle', { lieu: nomLieu(x), n: x.n }));
      el.style.width = el.style.height = `${2 * r}px`;
      el.style.fontSize = r >= 20 ? '13px' : '11px';
      el.textContent = r >= 13 ? (x.n >= 10000 ? `${Math.round(x.n / 1000)}k` : String(x.n)) : '';
      el.addEventListener('click', (e) => { e.stopPropagation(); rappel.current && rappel.current(x.cle); });
      marqueurs.current.push(new ml.Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat([x.lon, x.lat]).addTo(carte));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, cleBulles, max]);
  // Le cadrage suit la vue (monde / France).
  const reduit = React.useMemo(() => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } }, []);
  const premier = React.useRef(true);
  React.useEffect(() => {
    const carte = carteRef.current; if (!pose || !carte) return;
    cadrer(carte, vue, bulles, !premier.current && !reduit);
    premier.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, vue]);
  React.useEffect(() => {
    for (const m of marqueurs.current) { const el = m.getElement(); el.setAttribute('aria-pressed', el.getAttribute('data-cv-bulle') === choisi ? 'true' : 'false'); }
  }, [choisi, pose, cleBulles]);
  const ko = etat === 'ko';
  return (
    <div className="vrm-cv-cadre" data-cv-fond={etat}>
      <div ref={boite} className={'vrm-cv-carte' + (ko ? ' is-ko' : '')} role="region" aria-label={tr('fc.carteNom')}/>
      {ko ? <p className="vrm-fc-nom-s vrm-cv-ko" data-cv-ko="">{tr('fc.carteKo')}</p> : null}
    </div>
  );
}
