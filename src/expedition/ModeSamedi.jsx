// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 163 — LE MODE « SAMEDI » : la journée d'envoi sur un seul écran (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  1 · Imprimer — LE bouton plein de l'écran : « Imprimer (N) », le parcours d'impression simple
//      (le même toucher que Colis : PDF tamponné ou imprimante thermique jumelée) ;
//  2 · Emballer — chaque colis, une case (SON toucher), groupés par plateforme avec « Ce que
//      demande {plateforme} » en tête de groupe ; les colis d'un même acheteur rapprochés et
//      rappelés ;
//  3 · Trajet — les points de dépôt et de retrait dans l'ordre (vol d'oiseau depuis la ville
//      réglée), l'heure limite d'aujourd'hui de chacun ; « Déposé » = le geste « Colis fait »
//      d'avant (annulable 5 s) ; à retirer : le code.
//  Les règles : modeSamedi.js (trajet, heures), memeAcheteur.js, consignesColis.js. Aucun
//  nombre recalculé ici : les colis et leur ordre viennent de l'écran Colis (« Préparer »).
//  Plein écran par portail (jamais `-webkit-overflow-scrolling` sur un conteneur de feuille),
//  `Retour` (= FermeAuRetour), Échap ferme. Tout texte par tr() (clés `exp.samedi.*`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, langueCourante } from '../i18n/index.js';
import { pointsDuJour, limiteDuJour, jourParis, CLE_EMBALLES, emballesDuJour, basculerEmballe } from './modeSamedi.js';
import { autresDuGroupe } from './memeAcheteur.js';
import { RappelMemeAcheteur } from './MemeAcheteur.jsx';
import ConsignesColis from './ConsignesColis.jsx';
import './expedition.css';

const PLATEFORMES = ['vinted', 'leboncoin', 'vestiaire', 'ebay'];
const heureDe = (x) => { const [H, M] = String(x || '').split(':').map(Number); if (!Number.isFinite(H)) return ''; if (langueCourante() === 'fr') return M ? `${H} h ${String(M).padStart(2, '0')}` : `${H} h`; return `${String(H).padStart(2, '0')}:${String(M || 0).padStart(2, '0')}`; };
const kmDe = (km) => { if (!Number.isFinite(km)) return ''; try { return new Intl.NumberFormat(langueCourante() === 'en' ? 'en-GB' : `${langueCourante()}-${langueCourante().toUpperCase()}`, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km); } catch (_) { return String(Math.round(km * 10) / 10); } };

// Les positions : la ville réglée, et les adresses de retrait (rue + code postal) — la Base Adresse
// Nationale (api-adresse.data.gouv.fr, gratuite, permise par la CSP), mémoire sur l'appareil.
const CLE_GEO = 'vrm_samedi_geo';
const lireGeo = () => { try { const o = JSON.parse(localStorage.getItem(CLE_GEO) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };
async function geocoder(q, municipalite = false) {
  const cache = lireGeo(); const k = `${municipalite ? 'v' : 'a'}:${q.toLowerCase()}`;
  if (cache[k] && Number.isFinite(cache[k].lat)) return cache[k];
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(q)}${municipalite ? '&type=municipality' : ''}`, { credentials: 'omit' });
    const j = r.ok ? await r.json() : null; const f = j && j.features && j.features[0];
    if (!f || !f.geometry || (f.properties && Number(f.properties.score) < 0.5)) return null;
    const v = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    try { const c = lireGeo(); c[k] = v; const e = Object.entries(c).slice(-60); localStorage.setItem(CLE_GEO, JSON.stringify(Object.fromEntries(e))); } catch (_) {}
    return v;
  } catch (_) { return null; }
}
const adresseCherchable = (a) => /^\s*\d{1,4}\s*(?:bis|ter)?[\s,]+\S{2,}/i.test(String(a || '')) && /\b\d{5}\b/.test(String(a || ''));

export default function ModeSamedi({ colis = [], retraits = [], horairesRetrait = () => null, chargerDepots = null, ville = '',
  groupes = [], impression = null, attente = '', onDeposer, onAnnuler, onFermer, Retour = null, Photo = null, zIndex = 8500, maintenant = null }) {
  const ms = maintenant || Date.now();
  const jour = jourParis(ms);
  const [cases, setCases] = React.useState(() => { try { return emballesDuJour(JSON.parse(localStorage.getItem(CLE_EMBALLES) || 'null'), jour); } catch (_) { return {}; } });
  const cocher = (cle) => setCases((c) => { const u = basculerEmballe(c, cle); try { localStorage.setItem(CLE_EMBALLES, JSON.stringify({ jour, cles: u })); } catch (_) {} return u; });
  const [depots, setDepots] = React.useState(null);           // null = en cours · [] = aucun lu
  React.useEffect(() => { let v = true; if (typeof chargerDepots !== 'function') { setDepots([]); return undefined; } Promise.resolve(chargerDepots()).then((d) => { if (v) setDepots((d && Array.isArray(d.carriers)) ? d.carriers : []); }, () => { if (v) setDepots([]); }); return () => { v = false; }; }, [chargerDepots]);
  const [depart, setDepart] = React.useState(undefined);       // undefined = en cours · null = pas su
  React.useEffect(() => { let v = true; const q = String(ville || '').trim(); if (!q) { setDepart(null); return undefined; } geocoder(q, true).then((g) => { if (v) setDepart(g); }); return () => { v = false; }; }, [ville]);
  const [posRetraits, setPosRetraits] = React.useState({});
  React.useEffect(() => {
    let v = true;
    const a = [...new Set(retraits.map((r) => r.adresse).filter(adresseCherchable))].slice(0, 8);
    (async () => { const out = {}; for (const x of a) { const g = await geocoder(x); if (g) out[x] = g; } if (v) setPosRetraits(out); })();
    return () => { v = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retraits.map((r) => r.adresse).join('|')]);
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') { e.preventDefault(); onFermer && onFermer(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onFermer]);

  const aDeposer = colis.filter(Boolean);
  const points = React.useMemo(() => pointsDuJour({
    colis: aDeposer.map((c) => ({ cle: c.cle, trCle: c.trCle || '', transporteur: c.transporteur || '' })),
    depots: depots || [],
    retraits: retraits.map((r) => ({ cle: r.cle, lieu: r.lieu, adresse: r.adresse, horaires: horairesRetrait(r), ...(posRetraits[r.adresse] || {}) })),
    depart: depart || null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [colis, retraits, depots, depart, posRetraits]);
  const parCle = new Map(colis.map((c) => [c.cle, c]));
  const retraitParCle = new Map(retraits.map((r) => [r.cle, r]));
  const nEmb = colis.filter((c) => cases[c.cle]).length;
  const parSite = PLATEFORMES.map((s) => ({ site: s, colis: colis.filter((c) => c.site === s) })).filter((g) => g.colis.length);
  const limiteDe = (g) => { const l = g.colis.map((c) => c.limite).filter(Boolean); return l.length === g.colis.length && new Set(l).size === 1 ? l[0] : ''; };
  const dateTxt = (() => { try { return new Intl.DateTimeFormat(langueCourante() === 'en' ? 'en-GB' : langueCourante(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(ms)); } catch (_) { return jour; } })();
  const heureLimite = (p) => {
    const l = limiteDuJour(p.horaires, ms);
    if (l.etat === 'ouvert') return { cle: l.maintenant ? 'exp.samedi.heure.ouvert' : 'exp.samedi.heure.plusTard', vars: { heure: heureDe(l.fermeA) }, etat: 'ouvert' };
    if (l.etat === 'passe') return { cle: 'exp.samedi.heure.passe', vars: { heure: heureDe(l.fermeA) }, etat: 'passe' };
    if (l.etat === 'ferme') return { cle: 'exp.samedi.heure.ferme', vars: {}, etat: 'ferme' };
    return { cle: 'exp.samedi.heure.inconnu', vars: {}, etat: 'inconnu' };
  };
  const nomPoint = (p) => (p.type === 'depot' ? (p.nom || tr('exp.samedi.depotNimporte', { transporteur: p.transporteur || tr('exp.samedi.transporteurInconnu') })) : (p.nom || tr('exp.samedi.lieuInconnu')));
  const distance = (p) => (Number.isFinite(p.km) ? tr(p.depuis === 'depart' ? 'exp.samedi.kmDepart' : p.depuis === 'precedent' ? 'exp.samedi.kmPrecedent' : 'exp.samedi.kmPlateforme', { km: kmDe(p.km) }) : tr('exp.samedi.kmInconnu'));

  const corps = (
    <div className="vrm-exp vrm-samedi" data-espace="ventes" role="dialog" aria-modal="true" aria-label={tr('exp.samedi.titre')} data-mode-samedi="" style={{ zIndex }}
      data-samedi-imprimer={impression ? impression.n : 0} data-samedi-emballer={colis.length} data-samedi-points={points.length}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-samedi-defile">
        <header className="vrm-samedi-tete">
          <div>
            <p className="sb-surtitre vrm-samedi-date">{dateTxt}</p>
            <h1 className="sb-ecran-titre vrm-samedi-titre">{tr('exp.samedi.titre')}</h1>
          </div>
          <button type="button" className="sb-rond" aria-label={tr('exp.samedi.fermer')} data-samedi-fermer="" onClick={onFermer}><span aria-hidden="true">×</span></button>
        </header>
        <p className="vrm-samedi-bande" data-samedi-bande="">
          <span><b>{impression ? impression.n : 0}</b> {tr('exp.samedi.bande.imprimer', { n: impression ? impression.n : 0 })}</span>
          <span><b>{nEmb}/{colis.length}</b> {tr('exp.samedi.bande.emballes', { n: colis.length })}</span>
          <span><b>{points.length}</b> {tr('exp.samedi.bande.points', { n: points.length })}</span>
        </p>

        <section className="vrm-samedi-etape" data-samedi-etape="imprimer" aria-labelledby="vrm-samedi-imprimer">
          <h2 id="vrm-samedi-imprimer" className="vrm-samedi-h2">{tr('exp.samedi.imprimer.titre')}</h2>
          {impression && impression.n > 0 ? <div className="vrm-samedi-imprimer">
            <button type="button" className="sb-btn-plein" data-samedi-imprimer-btn="" data-impr-pret={impression.pret ? '1' : '0'} aria-busy={impression.occupe ? 'true' : undefined} disabled={!!impression.occupe} onClick={impression.onImprimer}>
              <span aria-hidden="true" className="vrm-samedi-plein-icone">⎙</span>{impression.occupe ? tr('exp.samedi.imprimer.enCours') : tr('exp.samedi.imprimer.bouton', { n: impression.n })}
            </button>
            <div className="vrm-samedi-imprimer-dit">
              <p className="vrm-exp-phrase">{tr('exp.samedi.imprimer.phrase', { n: impression.n, format: impression.format || '' })}</p>
              {impression.ligne || null}
            </div>
          </div> : <p className="vrm-exp-sous" data-samedi-rien-imprimer="">{tr('exp.samedi.imprimer.rien')}</p>}
        </section>

        <section className="vrm-samedi-etape" data-samedi-etape="emballer" aria-labelledby="vrm-samedi-emballer">
          <h2 id="vrm-samedi-emballer" className="vrm-samedi-h2">{tr('exp.samedi.emballer.titre')} <span className="vrm-exp-sous">{nEmb}/{colis.length}</span></h2>
          {!colis.length ? <p className="vrm-exp-sous">{tr('exp.samedi.emballer.rien')}</p> : null}
          {parSite.map((g) => (
            <div key={g.site} className="vrm-samedi-groupe" data-samedi-groupe={g.site}>
              <ConsignesColis site={g.site} limite={limiteDe(g)}/>
              <ul className="vrm-samedi-liste">
                {g.colis.map((c) => {
                  const coche = !!cases[c.cle];
                  const autres = autresDuGroupe(groupes, c.cle).map((k) => parCle.get(k)).filter(Boolean);
                  return (
                    <li key={c.cle} className="vrm-samedi-rangee" data-samedi-colis={c.cle} data-samedi-emballe={coche ? '1' : '0'}>
                      <button type="button" role="checkbox" aria-checked={coche ? 'true' : 'false'} className="sb-touche vrm-samedi-case" data-samedi-case={c.cle}
                        aria-label={tr(coche ? 'exp.samedi.emballe.aria.oui' : 'exp.samedi.emballe.aria.non', { qui: c.num ? `N°${c.num}` : c.titre })} onClick={() => cocher(c.cle)}>
                        <span aria-hidden="true">{coche ? '✓' : ''}</span>
                      </button>
                      {c.num ? <span className={`sb-plaque${c.etatNum === 'double' ? ' is-double' : ''}`} data-samedi-num={c.num}><small>N°</small>{c.num}</span> : <span className="sb-plaque" data-samedi-num=""><small>N°</small>—</span>}
                      {Photo && c.photo ? <span className="sb-vignette">{Photo(c.photo)}</span> : <span className="sb-vignette" aria-hidden="true"/>}
                      <span className="vrm-samedi-texte">
                        <span className="vrm-samedi-nom">{c.titre}</span>
                        <span className="vrm-exp-sous">{[c.taille, c.compte, c.transporteur].filter(Boolean).join(' · ')}{c.limite ? <> · <span className={c.limiteAmbre ? 'vrm-exp-ambre' : undefined}>{c.limite}</span></> : null}</span>
                        <RappelMemeAcheteur autres={autres}/>
                      </span>
                    </li>);
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="vrm-samedi-etape" data-samedi-etape="trajet" aria-labelledby="vrm-samedi-trajet">
          <h2 id="vrm-samedi-trajet" className="vrm-samedi-h2">{tr('exp.samedi.trajet.titre')}</h2>
          <p className="vrm-exp-sous" data-samedi-depart={depart ? 'ok' : depart === null ? 'pasSu' : 'enCours'}>
            {depart ? tr('exp.samedi.trajet.depuis', { ville }) : depart === null ? tr(String(ville || '').trim() ? 'exp.samedi.trajet.villeIntrouvable' : 'exp.samedi.trajet.sansVille') : tr('exp.samedi.trajet.calcul')}
          </p>
          {depots === null ? <p className="vrm-exp-sous">{tr('exp.samedi.trajet.lecture')}</p> : null}
          {!points.length ? <p className="vrm-exp-sous">{tr('exp.samedi.trajet.rien')}</p> : null}
          <ol className="vrm-samedi-points">
            {points.map((p) => {
              const h = heureLimite(p);
              return (
                <li key={p.cle} className="vrm-samedi-point" data-samedi-point={p.cle} data-samedi-point-type={p.type} data-samedi-rang={p.rang} data-samedi-heure={h.etat} data-samedi-km={Number.isFinite(p.km) ? p.km.toFixed(2) : ''}>
                  <span className="vrm-samedi-rang" aria-hidden="true">{p.rang}</span>
                  <div className="vrm-samedi-point-corps">
                    <p className="vrm-samedi-point-tete"><span className="vrm-samedi-type">{tr(p.type === 'depot' ? 'exp.samedi.deposer' : 'exp.samedi.retirer', { n: p.colis.length })}</span> <b className="vrm-samedi-point-nom">{nomPoint(p)}</b></p>
                    {p.adresse ? <p className="vrm-exp-sous">{p.adresse}</p> : null}
                    <p className="vrm-exp-sous"><span data-samedi-distance="">{distance(p)}</span> · <span className={h.etat === 'passe' || h.etat === 'ferme' ? 'vrm-exp-ambre' : undefined} data-samedi-heure-dite="">{tr(h.cle, h.vars)}</span></p>
                    {p.type === 'depot' && !p.propose && p.trCle && depots && depots.length ? <p className="vrm-exp-sous">{tr('exp.samedi.depotPasLu')}</p> : null}
                    <ul className="vrm-samedi-point-colis">
                      {p.colis.map((k) => {
                        if (p.type === 'retrait') { const r = retraitParCle.get(k); if (!r) return null; return <li key={k} data-samedi-retrait={k}><span className="vrm-samedi-nom">{r.titre}</span>{r.code ? <span className="sb-plaque sb-plaque--grande" data-samedi-code="">{r.code}</span> : <span className="vrm-exp-sous">{tr('exp.samedi.sansCode')}</span>}</li>; }
                        const c = parCle.get(k); if (!c) return null;
                        const enAttente = attente && String(attente) === k;
                        return <li key={k} data-samedi-depot={k}>
                          {c.num ? <span className="sb-plaque"><small>N°</small>{c.num}</span> : null}<span className="vrm-samedi-nom">{c.titre}</span>
                          {c.peutFaire && c.geste ? (enAttente
                            ? <button type="button" className="sb-lien" data-samedi-annuler={k} onClick={() => onAnnuler && onAnnuler()}>{tr('exp.samedi.annuler')}</button>
                            : <button type="button" className="sb-touche" data-samedi-deposer={k} onClick={() => onDeposer && onDeposer(c)}>{tr('exp.samedi.depose')}</button>)
                            : <span className="vrm-exp-sous">{tr(c.site === 'ebay' ? 'exp.samedi.ebaySuivi' : 'exp.samedi.pasDeGeste')}</span>}
                        </li>;
                      })}
                    </ul>
                  </div>
                </li>);
            })}
          </ol>
          <p className="vrm-exp-sous">{tr('exp.samedi.trajet.note')}</p>
        </section>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}
