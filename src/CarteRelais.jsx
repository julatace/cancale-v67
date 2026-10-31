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
//  · Le repère d'un point : la Base Adresse Nationale (api-adresse.data.gouv.fr,
//    gratuite, sans clé, déjà dans la CSP), sur l'ADRESSE lue (rue + code
//    postal), gardée seulement si elle est sûre (`repereDepuisBan`). Une adresse
//    incomplète ou incertaine ⇒ le point est listé SANS repère, et c'est dit —
//    jamais une épingle au centre de la ville. Les repères trouvés sont gardés
//    dans CE navigateur (`vrm_geo_relais_v1`, une commodité : perdu, il coûte
//    une recherche) ; un échec n'est pas redemandé avant 24 h.
//  · Pas de WebGL, style injoignable ⇒ « carte indisponible ici », la liste reste.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { repereDepuisBan } from './relaisColis.js';

const CACHE = 'vrm_geo_relais_v1';
const lireCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || '{}') || {}; } catch (_) { return {}; } };
const ecrireCache = (c) => { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (_) {} };
const cleAdr = (a) => String(a || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function chercherRepere(adresse, cp) {
  const k = cleAdr(adresse);
  const cache = lireCache();
  const c = cache[k];
  if (c && c.lat != null) return c;
  if (c && c.echec && Date.now() - c.echec < 24 * 3600e3) return null;
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(adresse)}${cp ? `&postcode=${cp}` : ''}`, { credentials: 'omit' });
    if (!r.ok) throw new Error('ban ' + r.status);
    const hit = repereDepuisBan(await r.json(), cp);
    const c2 = lireCache(); c2[k] = hit || { echec: Date.now() }; ecrireCache(c2);
    return hit;
  } catch (_) { return null; }   // réseau : pas noté, réessayé la fois suivante
}

const jourFr = (s) => { const t = Date.parse(String(s || '') + 'T12:00:00'); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; };

function FondRelais({ points, selection, onChoisir, C }) {
  const boite = React.useRef(null);
  const [etat, setEtat] = React.useState('charge');
  const cle = points.map((p) => `${p.cle}:${p.lat}:${p.lon}:${p.nArrives}:${p.nAttendus}`).join('|');
  React.useEffect(() => {
    let vivant = true, carte = null; const marqueurs = [];
    import('./fondCarte.js').then((f) => {
      if (!f.webglDispo()) throw new Error('webgl');
      return f.chargerMaplibre().then((ml) => {
        if (!vivant || !boite.current) return;
        const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2], zoom: 12, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
        carte.once('load', () => {
          if (points.length > 1) carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 48, maxZoom: 15, duration: 0 });
          else carte.setZoom(14);
          for (const p of points) {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'vrm-relais-epingle';
            el.setAttribute('data-relais-epingle', p.cle);
            el.setAttribute('data-relais-n', String(p.nArrives + p.nAttendus));
            el.setAttribute('aria-label', `${p.nom} : ${p.nArrives} arrivé${p.nArrives > 1 ? 's' : ''}, ${p.nAttendus} attendu${p.nAttendus > 1 ? 's' : ''}`);
            el.textContent = String(p.nArrives + p.nAttendus);
            // Une seule couleur d'accent, rare (§7) : l'épingle d'un point où des
            // colis ATTENDENT ; un point où ils ne sont qu'attendus reste neutre.
            el.style.cssText = `min-width:34px;height:34px;padding:0 8px;border-radius:17px;border:2px solid #fff;font:700 14px/30px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);color:${p.nArrives > 0 ? '#fff' : '#1d2430'};background:${p.nArrives > 0 ? (C.accent || '#2f5bd3') : '#fff'}`;
            if (p.nArrives > 0) el.setAttribute('data-relais-arrives', '');
            el.addEventListener('click', (e) => { e.stopPropagation(); onChoisir && onChoisir(p.cle); });
            marqueurs.push(new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(carte));
          }
          f.poserFond(carte, { sombre: false, annule: () => !vivant }).then(() => { if (vivant) setEtat('pret'); }).catch(() => { if (vivant) setEtat('ko'); });
        });
      });
    }).catch(() => { if (vivant) setEtat('ko'); });
    return () => { vivant = false; for (const m of marqueurs) { try { m.remove(); } catch (_) {} } if (carte) carte.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return (
    <div style={{ position: 'relative' }}>
      <div ref={boite} data-relais-fond={etat} className="vrm-relais-fond" style={{ width: '100%', height: 260, borderRadius: 10, overflow: 'hidden', background: '#eaeef2', display: etat === 'ko' ? 'none' : 'block' }}/>
      {etat === 'ko' && <div data-relais-carte-ko="" style={{ fontSize: 12, color: 'var(--vrm-muted, #667)', padding: '8px 0' }}>Carte indisponible ici (navigateur sans affichage 3D, ou fond de carte injoignable) — la liste ci-dessous reste juste.</div>}
      {selection ? <span className="vrm-sr">{selection}</span> : null}
    </div>
  );
}

// `compacte` (31 oct.) : en bas de la colonne « À retirer » de Colis (la maquette
// de Julien), la carte est posée ouverte, sans en-tête : le fond, puis une ligne
// par point. Ailleurs elle reste repliée, comme avant.
export default function CarteRelaisColis({ donnees, C, compacte = false }) {
  const [ouverte, setOuverte] = React.useState(!!compacte);
  const [reperes, setReperes] = React.useState({});      // cle → {lat,lon} | null (cherché, pas sûr)
  const [choisi, setChoisi] = React.useState('');
  const groupes = (donnees && donnees.groupes) || [];
  React.useEffect(() => {
    if (!ouverte) return undefined;
    let vivant = true;
    (async () => {
      let n = 0;
      for (const g of groupes) {
        if (!vivant || n >= 15) break;
        if (!g.geocode || reperes[g.cle] !== undefined) continue;
        n++;
        const hit = await chercherRepere(g.geocode, g.cp);
        if (!vivant) return;
        setReperes((r) => ({ ...r, [g.cle]: hit || null }));
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, groupes.map((g) => g.cle + g.geocode).join('|')]);
  if (!donnees) return null;
  const nArr = groupes.reduce((t, g) => t + g.nArrives, 0), nAtt = groupes.reduce((t, g) => t + g.nAttendus, 0);
  const sansRelais = Number(donnees.enRouteSansRelais) || 0;
  if (!groupes.length && !sansRelais) return null;
  const avecRepere = groupes.filter((g) => reperes[g.cle] && reperes[g.cle].lat != null).map((g) => ({ ...g, ...reperes[g.cle] }));
  const muted = { fontSize: 12, color: C.muted, lineHeight: 1.5 };
  if (compacte) return (
    <div className="vrm-relais-carte vrm-relais-compacte" data-relais-carte="ouverte" data-relais-points={groupes.length} data-relais-arrives={nArr} data-relais-attendus={nAtt} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {avecRepere.length > 0 && <FondRelais points={avecRepere} selection={choisi} onChoisir={setChoisi} C={C}/>}
      {groupes.map((g) => {
        const rp = reperes[g.cle];
        return (
          <div key={g.cle} data-relais-point={g.cle} data-relais-point-arrives={g.nArrives} data-relais-point-attendus={g.nAttendus} data-relais-repere={rp && rp.lat != null ? 'oui' : (rp === null || !g.geocode ? 'non' : 'cherche')} style={{ ...muted, color: C.text }}>
            <b>{g.nom}</b>{g.nArrives ? ` · ${g.nArrives} arrivé${g.nArrives > 1 ? 's' : ''}` : ''}{g.nAttendus ? ` · ${g.nAttendus} attendu${g.nAttendus > 1 ? 's' : ''}` : ''}
            {(!g.geocode || rp === null) ? <span style={{ color: C.muted }}> · pas sur la carte</span> : null}
          </div>
        );
      })}
      {sansRelais > 0 && <div style={{ ...muted, fontSize: 11.5 }}>{sansRelais} achat{sansRelais > 1 ? 's' : ''} en route sans destination connue.</div>}
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
          {avecRepere.length > 0 && <FondRelais points={avecRepere} selection={choisi} onChoisir={setChoisi} C={C}/>}
          {groupes.map((g) => {
            const rp = reperes[g.cle];
            return (
              <div key={g.cle} data-relais-point={g.cle} data-relais-point-arrives={g.nArrives} data-relais-point-attendus={g.nAttendus} data-relais-repere={rp && rp.lat != null ? 'oui' : (rp === null || !g.geocode ? 'non' : 'cherche')}
                style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, outline: choisi === g.cle ? `2px solid ${C.accent}` : 'none', outlineOffset: 2, borderRadius: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{g.nom}</div>
                {g.adresse ? <div style={muted}>{g.adresse}</div> : null}
                {(!g.geocode || rp === null) && <div data-relais-sans-repere="" style={{ ...muted, fontSize: 11.5 }}>{!g.geocode ? "Pas sur la carte : l'adresse lue est incomplète (il faut la rue et le code postal)." : "Pas sur la carte : cette adresse n'a pas été trouvée sûrement."}</div>}
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
