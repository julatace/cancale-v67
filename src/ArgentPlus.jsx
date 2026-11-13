// ════════════════════════════════════════════════════════════════════════════
//  ARGENT, EN PLUS (11 nov., lot agent2-argent-parrainage — validé par Julien)
//  · `PrevisionMoisCarte` (Argent → Statistiques) et `PrevisionLigne` (Ma journée) :
//    la règle pure `previsionMois` (src/previsionMois.js) sur le vendu PUBLIÉ par la
//    coque (`liveStats.venduLignes`) — une estimation, jamais un objectif.
//  · `CoutPlateformes` : « Ce que te coûte chaque site », la carte « Frais par site »
//    (sur la période, inchangée) ou, d'un geste, MOIS PAR MOIS côte à côte
//    (`coutParPlateforme`, src/coutPlateformes.js). Une seule vue à la fois : le
//    même nombre n'est jamais écrit deux fois sur l'écran (§7).
//  Aucun import d'App.jsx : ce que l'écran sait (relevé, Dépenses, eBay, règles)
//  arrive en props.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { previsionMois, textePrevision, eurosRonds } from './previsionMois.js';
import { coutParPlateforme, sitesMontresCout, moisAvant, nomMois, CATEGORIES_COUT } from './coutPlateformes.js';
import './argent-plus.css';

const lireReleveLocal = () => { try { const v = JSON.parse(localStorage.getItem('vrm_stats_ventes') || 'null'); return v && Array.isArray(v.l) ? v.l : null; } catch (_) { return null; } };
// Le relevé de Ventes, relu quand l'écran Ventes le republie (même évènement que `useLigneSynchro`).
function useReleve(fourni) {
  const [r, setR] = React.useState(() => (fourni !== undefined ? fourni : lireReleveLocal()));
  React.useEffect(() => {
    if (fourni !== undefined) { setR(fourni); return undefined; }
    const f = (e) => { if (e && e.detail && e.detail.k === 'vrm_stats_ventes') setR(lireReleveLocal()); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f);
  }, [fourni]);
  return r;
}
const venduDe = (liveStats) => (!liveStats ? undefined : liveStats.venduPasSu ? null : liveStats.venduLignes);
const manqueDe = (liveStats) => [...((liveStats && liveStats.venduManque) || []), ...(liveStats && liveStats.venduEnAttente ? ['lecture en cours'] : [])];

function usePrevision(liveStats, releveFourni) {
  const releve = useReleve(releveFourni);
  const vendu = venduDe(liveStats);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 10 * 60 * 1000); return () => clearInterval(t); }, []);
  return React.useMemo(() => previsionMois({ vendu, manque: manqueDe(liveStats), nonComptees: (liveStats && liveStats.venduNonComptees) || [], releve, maintenant }),
    [vendu, liveStats, releve, maintenant]);
}

const attrsPrev = (P) => ({
  'data-prev-etat': P.etat, 'data-prev-jours': String(P.jours), 'data-prev-centre': P.centre == null ? '' : String(P.centre),
  'data-prev-bas': P.bas == null ? '' : String(P.bas), 'data-prev-haut': P.haut == null ? '' : String(P.haut),
  'data-prev-mode': P.mode || undefined, 'data-prev-cumul': P.cumul == null ? '' : String(P.cumul),
  'data-prev-partiel': P.partiel ? '1' : undefined, 'data-prev-manques': P.manques.join(' | ') || undefined,
});

// ── Argent → Statistiques ───────────────────────────────────────────────────
export function PrevisionMoisCarte({ liveStats, releve, onSaisirPrix = null }) {
  const P = usePrevision(liveStats, releve);
  const T = textePrevision(P);
  const B = P.benef || {};
  // La barre : ce qui est vendu (plein), la fourchette (bande), le centre (trait). Aucun nombre écrit dessus.
  const echelle = P.etat === 'ok' ? Math.max(P.haut, 1) : 1;
  const pct = (x) => `${Math.max(0, Math.min(100, (x / echelle) * 100))}%`;
  return (
    <section className="vrm-ap-carte" data-argent-plus="prevision" {...attrsPrev(P)}>
      <div className="vrm-ap-tete">
        <h2 className="vrm-display vrm-ap-titre">{T.titre}</h2>
        <span className="vrm-ap-note">estimation</span>
      </div>
      <div className={'vrm-ap-grand' + (P.etat === 'ok' ? '' : ' is-vide')} data-prev-grand="">{T.grand}</div>
      {T.sous ? <div className="vrm-ap-sous" data-prev-sous="">{T.sous}</div> : null}
      {P.etat === 'ok' ? (
        <div className="vrm-ap-piste" aria-hidden="true">
          <span className="vrm-ap-bande" style={{ left: pct(P.bas), width: `calc(${pct(P.haut)} - ${pct(P.bas)})` }}/>
          <span className="vrm-ap-fait" style={{ width: pct(P.cumul) }}/>
          <span className="vrm-ap-centre" style={{ left: pct(P.centre) }}/>
        </div>
      ) : null}
      {T.manque ? <div className="vrm-ap-manque" data-prev-manque="">{T.manque}</div> : null}
      {P.etat === 'ok' ? (
        <div className="vrm-ap-benef" data-prev-benef={B.etat} data-prev-benef-centre={B.centre == null ? '' : String(B.centre)} data-prev-benef-couv={`${B.nConnu || 0}/${B.n || 0}`}>
          <span className="vrm-ap-benef-nom">Bénéfice brut</span>
          {B.etat === 'ok' ? (
            <span className="vrm-ap-benef-v">vers <b>{eurosRonds(B.centre)}</b><small> si ta marge reste la même</small></span>
          ) : B.etat === 'couverture' ? (
            <span className="vrm-ap-benef-v"><b className="is-vide">—</b><small> prix d’achat connus sur {B.nConnu}/{B.n} ventes</small>{onSaisirPrix && B.nConnu < B.n ? <button type="button" className="vrm-lien-action vrm-ap-saisir" data-prev-saisir="" onClick={onSaisirPrix}>Saisir ›</button> : null}</span>
          ) : (
            <span className="vrm-ap-benef-v"><b className="is-vide">—</b><small>{B.etat === 'aucune' ? ' aucune vente finalisée ce mois-ci' : ' ouvre Ventes une fois'}</small></span>
          )}
        </div>
      ) : null}
      <p className="vrm-ap-pied">Une estimation au rythme réel, pas une promesse.</p>
    </section>
  );
}

// ── Ma journée : UNE ligne, seulement quand la prévision est sue ────────────
export function PrevisionLigne({ liveStats, onOuvrir = null }) {
  const P = usePrevision(liveStats, undefined);
  const T = textePrevision(P);
  if (P.etat !== 'ok' || !T.ligne) return null;
  const court = P.manques.length ? ` (${P.manques.length === 1 ? T.manque : 'partiel'})` : '';
  return (
    <button type="button" className="vrm-ap-ligne" data-argent-plus="prevision-ligne" {...attrsPrev(P)} onClick={onOuvrir || undefined} disabled={!onOuvrir}>
      <span className="vrm-ap-ligne-t">{T.ligne}{court} <span className="vrm-ap-ligne-est" data-prev-estimation="">· estimation</span></span>
      {onOuvrir ? <span aria-hidden="true" className="vrm-ap-ligne-f">›</span> : null}
    </button>
  );
}

// ── Ce que te coûte chaque site : la période (carte d'avant) ou mois par mois ─
const SRC = { lu: 'lu chez le site', fiche: 'noté sur tes fiches', depenses: 'noté dans Dépenses', acheteur: 'payé par l’acheteur', passu: 'pas lu' };
const NOM_SITE = { Vinted: 'Vinted', Leboncoin: 'Leboncoin', eBay: 'eBay', Vestiaire: 'Vestiaire' };
const eur2 = (cts) => (cts == null ? '—' : `${(cts / 100).toLocaleString('fr-FR', { minimumFractionDigits: cts % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`);
const CLE_VUE = 'vrm_cout_sites_vue';

export function CoutPlateformes({ parPeriode = null, releve, ebay, compta, excluAutre, R, chargeAbo, Segmente = null, maintenant: tFourni = null }) {
  const [vue, setVueEtat] = React.useState(() => { try { return localStorage.getItem(CLE_VUE) === 'mois' ? 'mois' : 'periode'; } catch (_) { return 'periode'; } });
  const setVue = (v) => { const x = v === 'mois' ? 'mois' : 'periode'; setVueEtat(x); try { localStorage.setItem(CLE_VUE, x); } catch (_) {} };
  const [maintenant] = React.useState(() => tFourni || Date.now());
  const mois = React.useMemo(() => moisAvant(maintenant, 4), [maintenant]);
  const M = React.useMemo(() => (vue === 'mois' ? coutParPlateforme({ releve, ebay, compta, mois, excluAutre, R, chargeAbo }) : null),
    [vue, releve, ebay, compta, mois, excluAutre, R, chargeAbo]);
  const [ouvert, setOuvert] = React.useState(null);   // 'ym|site'
  const choix = [{ v: 'periode', l: 'Sur la période' }, { v: 'mois', l: 'Mois par mois' }];
  const bascule = Segmente
    ? <Segmente label="Vue" className="vrm-ap-vue" value={vue} onChange={setVue} options={choix.map((o) => ({ ...o, data: { 'data-cout-vue-choix': o.v } }))}/>
    : <div className="vrm-ap-vue" role="group">{choix.map((o) => <button key={o.v} type="button" aria-pressed={vue === o.v} data-cout-vue-choix={o.v} onClick={() => setVue(o.v)}>{o.l}</button>)}</div>;
  if (vue === 'periode') return <div className="vrm-ap-cout" data-cout-vue="periode">{bascule}{parPeriode}</div>;
  const sites = sitesMontresCout(M);
  const detail = ouvert ? (() => { const [ym, plat] = ouvert.split('|'); const m = M.find((x) => x.ym === ym); return m ? { m, s: m.sites.find((x) => x.plat === plat) } : null; })() : null;
  return (
    <div className="vrm-ap-cout" data-cout-vue="mois">
      {bascule}
      <section className="vrm-ap-carte" data-argent-plus="cout-mois" data-cout-mois={mois.join(',')}>
        <div className="vrm-ap-tete"><h2 className="vrm-display vrm-ap-titre">Ce que te coûte chaque site</h2><span className="vrm-ap-note">par mois</span></div>
        {!sites.length ? <p className="vrm-ap-sous" data-cout-vide="">Aucun frais ni vente sur ces 4 mois.</p> : (
          <div className="vrm-ap-table" role="table" aria-label="Coût par site et par mois" style={{ '--n': mois.length }}>
            <div className="vrm-ap-tr vrm-ap-th" role="row">
              <span role="columnheader" className="vrm-ap-site"/>
              {M.map((m, i) => <span key={m.ym} role="columnheader" className="vrm-ap-mois">{i === 0 ? 'Ce mois' : nomMois(m.ym, true)}</span>)}
            </div>
            {sites.map((plat) => (
              <div key={plat} className="vrm-ap-tr" role="row" data-cout-site={plat}>
                <span role="rowheader" className="vrm-ap-site">{NOM_SITE[plat]}</span>
                {M.map((m) => {
                  const s = m.sites.find((x) => x.plat === plat);
                  const k = `${m.ym}|${plat}`;
                  return (
                    <button key={k} type="button" role="cell" className="vrm-ap-td" aria-expanded={ouvert === k}
                      data-cout-cellule={k} data-cout-total={s.total == null ? '' : String(s.total)} data-cout-partiel={s.partiel ? '1' : undefined}
                      onClick={() => setOuvert(ouvert === k ? null : k)}
                      title={s.manques.length ? s.manques.join(' · ') : undefined}>
                      <span className={s.total == null ? 'is-vide' : undefined}>{s.total == null ? '—' : eur2(s.total)}</span>
                      {s.partiel && s.total != null ? <i aria-label="incomplet">*</i> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {detail && detail.s ? (
          <div className="vrm-ap-detail" data-cout-detail={`${detail.m.ym}|${detail.s.plat}`} aria-live="polite">
            <div className="vrm-ap-detail-t">{NOM_SITE[detail.s.plat]} · {nomMois(detail.m.ym)}</div>
            {CATEGORIES_COUT.map(([k, l]) => {
              const v = detail.s.cat[k];
              if (k === 'etiquettes' && detail.s.plat === 'eBay') return <div key={k} className="vrm-ap-dl" data-cout-cat={k} data-cout-src="acheteur"><span>{l}</span><span>{SRC.acheteur}</span></div>;
              if (k === 'vente' && detail.s.plat === 'Vestiaire') return <div key={k} className="vrm-ap-dl" data-cout-cat={k} data-cout-src="passu"><span>{l}</span><span><b className="is-vide">—</b> pas lus</span></div>;
              if (!v) return null;
              return <div key={k} className="vrm-ap-dl" data-cout-cat={k} data-cout-eur={String(v)} data-cout-src={detail.s.src[k]}><span>{l}</span><span><b>{eur2(v)}</b> · {SRC[detail.s.src[k]]}</span></div>;
            })}
            {detail.s.total === 0 && !detail.s.manques.length ? <div className="vrm-ap-dl" data-cout-zero=""><span>Rien de noté ni de lu</span><span>0 €</span></div> : null}
            {detail.s.manques.length ? <div className="vrm-ap-manque" data-cout-manques="">{detail.s.manques.join(' · ')}</div> : null}
          </div>
        ) : <p className="vrm-ap-pied">Touche un montant pour son détail. * = incomplet.</p>}
      </section>
    </div>
  );
}
