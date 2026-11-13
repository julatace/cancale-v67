// ── LA FEUILLE « BAISSER LE PRIX » (10 nov., lot C + AW) — règles : src/baissePrix.js ──
// Il a coché des annonces ; il choisit −X € ou −X %, voit ancien → nouveau prix
// pour chacune (plancher du lot F en ambre, décochée par défaut), puis
// « Baisser N prix » et le confirme. L'app envoie UNE commande à la fois
// (`onBaisser`, l'extension 5.336), attend sa réponse, montre le prix RELU,
// fait une courte pause, puis passe à la suivante. « Arrêter » coupe après celle
// en cours. Rien ne part avant son clic ; rien n'est programmé ni répété.
import React from 'react';
import { createPortal } from 'react-dom';
import { baisseTapee, lignesBaisse, comptesAOuvrir, issueBaisse, bilanBaisse, eurosBaisse as eur } from './baissePrix.js';
import './styles-annonces-outils.css';
import './styles-baisse-prix.css';
import { suivi } from './suiviTravail.js';   // (11 nov., lot suivi-travail) VRM figé, détail et barre pendant la série
import JaugeActions from './JaugeActions.jsx';   // (10 nov., lot G) les 50 actions/h du compte de l'onglet
// (12 nov., ext. 5.370 — discrétion, point 12) SON choix varie un peu par annonce (± 20 %, montré),
// et les baisses peuvent être ÉTALÉES dans la journée : l'extension les garde et les fait une à
// une, à leur heure, onglet vinted.fr ouvert (`planifierBaisses`). Règles : src/discretion.js.
import { facteursBaisse, heuresEtalees, ETALEMENT_H } from './discretion.js';
import { heureFr } from './jaugeActions.js';
import { tr } from './i18n/index.js';

const ETAT = { prevue: 'Prévue', envoi: 'Envoi…', fait: 'Fait', ecart: 'Autre prix', incertain: 'Pas relu', echec: 'Refusé', refus: 'Pas envoyée', 'pas-envoye': 'Pas envoyée' };
const pauseEntre = () => {
  const f = typeof window !== 'undefined' && window.__VRM_BAISSE_PAUSE;
  if (Number.isFinite(f) && f >= 0) return f;
  return 3000 + Math.floor(Math.random() * 5000);   // 3 à 8 s entre deux annonces : jamais une rafale
};

// (11 nov. soir) `baisseInitiale` : { mode, texte } — la baisse PROPOSÉE par « Changer le prix »
// (src/PrixPartout.jsx : un prix modifié dans VRM ⇒ sur Vinted, VRM propose, son clic ici envoie).
// (11 nov., lot lbc-plus) La MÊME feuille pour Leboncoin : `site='leboncoin'` (les phrases du site),
// `modeDefaut`/`texteDefaut` (−5 % proposé, il change s'il veut), `onRelire` : après la série, les
// prix envoyés que Leboncoin a acceptés sans les montrer sont RELUS (« Mes annonces » relue par
// l'extension) — relu égal ⇒ « Fait », autre ⇒ « Autre prix », rien de neuf ⇒ reste « Pas relu ».
// `baisseInitiale` (proposée) l'emporte sur `modeDefaut`/`texteDefaut`.
export default function BaissePrixSerie({ annonces = [], compteOnglet, plancherDe, extRaison = '', onBaisser, onRelire = null, onFermer, onFini, Photo, Retour, site = 'vinted', modeDefaut = 'eur', texteDefaut = '5', baisseInitiale = null, etaleOk = false, onProgrammer = null, onAnnulerProgramme = null }) {
  const nomSite = site === 'leboncoin' ? 'Leboncoin' : 'Vinted';
  const [mode, setMode] = React.useState(baisseInitiale && baisseInitiale.mode ? (baisseInitiale.mode === 'pct' ? 'pct' : 'eur') : modeDefaut);
  const [texte, setTexte] = React.useState(baisseInitiale && baisseInitiale.texte ? String(baisseInitiale.texte) : texteDefaut);
  const [coches, setCoches] = React.useState(null);        // null : les coches par défaut de l'aperçu
  const [phase, setPhase] = React.useState('choix');        // choix · confirmer · envoi · fini
  const [etats, setEtats] = React.useState({});
  const [progres, setProgres] = React.useState({ i: 0, n: 0 });
  const arret = React.useRef(false);
  const [arretDemande, setArretDemande] = React.useState(false);
  const baisse = baisseTapee(mode, texte);
  // Le facteur de chaque annonce est tiré UNE fois (l'aperçu ne bouge pas à chaque frappe).
  const [varier, setVarier] = React.useState(true);
  const facteurs = React.useMemo(() => facteursBaisse(annonces.map((a) => a && a.id)), [annonces]);
  const [quand, setQuand] = React.useState(etaleOk ? 'etale' : 'maintenant');
  const etale = quand === 'etale' && etaleOk && typeof onProgrammer === 'function';
  const [programme, setProgramme] = React.useState(null);   // { n, de, a } une fois rangé par l'extension
  const [heures, setHeures] = React.useState({});           // id → heure prévue (montrée avant de confirmer)
  const lignes = React.useMemo(() => lignesBaisse({ annonces, baisse, compteOnglet, plancherDe, facteurs: varier && site === 'vinted' ? facteurs : null, site }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annonces, mode, texte, compteOnglet, plancherDe, varier, facteurs]);
  const coche = (l) => (coches && Object.prototype.hasOwnProperty.call(coches, l.id) ? coches[l.id] : l.coche) && !l.bloque && l.nouveau != null;
  const choisies = lignes.filter(coche);
  const ouvrir = comptesAOuvrir(lignes);
  const nSous = lignes.filter((l) => l.sousPlancher).length;
  const enCours = phase === 'envoi';
  const fige = phase !== 'choix';
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  const basculer = (l) => { if (fige || l.bloque || l.nouveau == null) return; setCoches((c) => ({ ...(c || {}), [l.id]: !coche(l) })); };
  const demanderConfirmation = () => {
    if (etale) { const h = heuresEtalees(choisies.length); setHeures(Object.fromEntries(choisies.map((l, i) => [l.id, h[i]]))); }
    setPhase('confirmer');
  };
  const programmer = async () => {
    const file = choisies.slice();
    if (!file.length || extRaison) return;
    setPhase('envoi'); setProgres({ i: 0, n: file.length });
    let r = null; try { r = await onProgrammer(file.map((l) => ({ ...l, at: heures[l.id] }))); } catch (_) { r = null; }
    if (r && r.accepte) {
      const ats = file.map((l) => heures[l.id]).filter(Number.isFinite).sort((a, b) => a - b);
      setProgramme({ n: file.length, de: ats[0], a: ats[ats.length - 1] });
      setEtats(Object.fromEntries(file.map((l) => [l.id, { etat: 'prevue', raison: '' }])));
    } else {
      setEtats(Object.fromEntries(file.map((l) => [l.id, { etat: 'refus', raison: (r && r.raison) || 'L’extension ne répond pas ici : rien n’est programmé' }])));
    }
    setPhase('fini');
  };
  const lancer = async () => {
    if (etale) return programmer();
    const file = choisies.slice();                           // figée au clic : l'aperçu qu'il a vu
    if (!file.length || extRaison) return;
    arret.current = false; setArretDemande(false);
    setPhase('envoi'); setEtats({}); setProgres({ i: 0, n: file.length });
    const res = {};
    // (11 nov., Julien : « VRM reste FIGÉ avec le DÉTAIL et une BARRE ») La feuille « VRM travaille ».
    const t = suivi.demarrer({ sorte: 'baisse-prix', titre: `Baisser le prix (${baisse.mode === 'pct' ? `−${baisse.valeur} %` : `−${baisse.valeur} €`})`,
      etapes: [['envoi', `Envoi du nouveau prix à ${nomSite}`], ['relu', `Prix relu sur ${nomSite}`]], uid: site === 'vinted' ? (compteOnglet || '') : '',
      articles: file.map((l) => ({ id: l.id, num: l.numero || '', titre: l.titre || '' })) });
    const poser = (id, e) => { res[id] = e; setEtats((x) => ({ ...x, [id]: e })); };
    let stopVinted = '';
    for (let i = 0; i < file.length; i++) {
      const l = file[i];
      if (t && !(await t.continuer())) arret.current = true;
      if (arret.current) { for (const m of file.slice(i)) poser(m.id, { etat: 'pas-envoye', raison: 'Arrêtée par toi' }); break; }
      setProgres({ i: i + 1, n: file.length });
      poser(l.id, { etat: 'envoi' });
      if (t) t.etape(l.id, 'envoi', l.prix != null && l.nouveau != null ? `${eur(l.prix)} → ${eur(l.nouveau)}` : '');
      let r = null; try { r = await onBaisser(l); } catch (_) { r = null; }
      // (5.370) La discrétion dit « attends » (autre compte, série, ouverture) : on attend, puis on réessaie la même.
      if (r && r.accepte === false && r.code === 'discretion' && Number(r.attendreMs) > 0 && !arret.current) {
        poser(l.id, { etat: 'envoi', raison: r.raison || '' });
        const fin = Date.now() + Number(r.attendreMs) + 5000;
        while (Date.now() < fin && !arret.current) await new Promise((ok) => setTimeout(ok, Math.min(1000, Math.max(0, fin - Date.now()))));
        if (!arret.current) { i--; continue; }
      }
      const iss = issueBaisse(r);
      if (r && r.accepte === true && r.etape === 'envoye') iss.aRelire = true;   // accepté, prix pas montré : relu après la série
      poser(l.id, iss);
      if (t) {
        if (iss.etat === 'fait' || iss.etat === 'ecart') t.etape(l.id, 'relu', iss.prixVu != null ? eur(iss.prixVu) : '');
        const finT = iss.etat === 'fait' ? { etat: 'ok' }
          : iss.aRelire ? null
          : iss.etat === 'ecart' || iss.etat === 'incertain' ? { etat: 'main', raison: iss.raison || (iss.etat === 'ecart' ? `${nomSite} montre un autre prix` : 'pas relu'), geste: `Regarde l’annonce sur ${nomSite}` }
          : { etat: 'refus', raison: iss.raison, geste: iss.arret ? `Attends la fin de la pause de ${nomSite}, puis relance` : '' };
        if (finT) t.fin(l.id, finT);
      }
      if (iss.arret) { stopVinted = iss.raison || 'refus'; for (const m of file.slice(i + 1)) { poser(m.id, { etat: 'pas-envoye', raison: iss.raison }); if (t) t.fin(m.id, { etat: 'saute', raison: iss.raison }); } break; }
      if (i < file.length - 1) {
        const ms = pauseEntre();
        const fin = Date.now() + ms;
        if (t && ms >= 1000) t.pause({ ms, raison: 'Pause entre deux annonces' });
        while (Date.now() < fin && !arret.current && !(t && t.doitSArreter())) await new Promise((ok) => setTimeout(ok, Math.min(250, Math.max(0, fin - Date.now()))));
        if (t) t.finPause();
      }
    }
    // (11 nov., lot lbc-plus) RELIRE ce que le site a accepté sans montrer le prix (Leboncoin).
    const aRelire = file.filter((l) => res[l.id] && res[l.id].aRelire);
    if (aRelire.length && onRelire) {
      for (const l of aRelire) if (t) t.etape(l.id, 'relu', tr('lbcplus.baisse.relecture'));
      let vus = null; try { vus = await onRelire(aRelire); } catch (_) { vus = null; }
      for (const l of aRelire) {
        const pv = vus && vus[l.id] != null && Number.isFinite(Number(vus[l.id])) ? Number(vus[l.id]) : null;
        const e = pv == null ? { etat: 'incertain', prixVu: null, raison: tr('lbcplus.baisse.pasRelu', { site: nomSite }) }
          : Math.round(pv * 100) === Math.round(Number(l.nouveau) * 100) ? { etat: 'fait', prixVu: pv, raison: '' }
            : { etat: 'ecart', prixVu: pv, raison: tr('lbcplus.baisse.autrePrix', { site: nomSite }) };
        poser(l.id, e);
        if (t) t.fin(l.id, e.etat === 'fait' ? { etat: 'ok' } : { etat: 'main', raison: e.raison, geste: tr('lbcplus.baisse.regarder', { site: nomSite }) });
      }
    } else for (const l of aRelire) if (t) t.fin(l.id, { etat: 'main', raison: tr('lbcplus.baisse.pasRelu', { site: nomSite }), geste: tr('lbcplus.baisse.regarder', { site: nomSite }) });
    if (t) t.terminer(arret.current ? 'arrêté par toi' : stopVinted, stopVinted ? 'arrete' : undefined);
    setPhase('fini');
    if (onFini) onFini(file.map((l) => ({ ligne: l, issue: res[l.id] || null })));
  };
  const bilan = bilanBaisse(etats);
  const unite = mode === 'pct' ? '%' : '€';
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile" data-baisse-serie={lignes.length} data-bp-phase={phase} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour fermer={() => { if (!enCours) onFermer(); }}/> : null}
      <div className="vrm-ao-feuille vrm-bp" role="dialog" aria-modal="true" aria-label="Baisser le prix">
        <header className="vrm-ao-tete">
          <h2>Baisser le prix</h2>
          <span className="vrm-ao-num">{lignes.length} annonce{lignes.length > 1 ? 's' : ''}</span>
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-bp-fermer="" onClick={onFermer} disabled={enCours}>×</button>
        </header>
        <div className="vrm-bp-reglage">
          <div className="vrm-bp-modes" role="group" aria-label="Baisse en euros ou en pourcentage">
            {[['eur', '− €'], ['pct', '− %']].map(([v, t]) => (
              <button key={v} type="button" className="vrm-bp-mode" aria-pressed={mode === v} data-bp-mode={v} disabled={fige} onClick={() => { setMode(v); setCoches(null); }}>{t}</button>
            ))}
          </div>
          <label className="vrm-bp-champ">
            <span aria-hidden="true">−</span>
            <input inputMode="decimal" autoComplete="off" value={texte} disabled={fige} data-bp-valeur="" aria-label={`Baisse (${unite})`}
              aria-invalid={baisse.ok ? undefined : 'true'} onChange={(e) => { setTexte(e.target.value); setCoches(null); }}/>
            <b>{unite}</b>
          </label>
        </div>
        <p className="vrm-bp-note">{site === 'leboncoin' ? tr('lbcplus.baisse.note') : 'Arrondi à l’euro. Le prix change sur Vinted, annonce par annonce, puis VRM le relit.'}</p>
        {site === 'vinted' ? <div className="vrm-bp-options" data-bp-options="">
          <label className="vrm-bp-option"><input type="checkbox" checked={varier} disabled={fige} onChange={(e) => { setVarier(e.target.checked); setCoches(null); }} data-bp-varier={varier ? '1' : '0'}/><span>Varier un peu (± 20 %)</span></label>
          {etaleOk && onProgrammer ? (
            <div className="vrm-bp-modes vrm-bp-quand" role="group" aria-label="Quand">
              {[['etale', `Dans les ${ETALEMENT_H} h`], ['maintenant', 'Maintenant']].map(([v, t]) => (
                <button key={v} type="button" className="vrm-bp-mode" aria-pressed={quand === v} data-bp-quand={v} disabled={fige} onClick={() => setQuand(v)}>{t}</button>
              ))}
            </div>
          ) : null}
        </div> : null}
        {compteOnglet && site === 'vinted' ? <div className="vrm-bp-plafond"><JaugeActions uid={compteOnglet} /></div> : null}
        {!baisse.ok ? <p className="vrm-ao-mini" role="alert" data-bp-erreur="">{baisse.erreur}</p> : null}
        {extRaison ? <p className="vrm-ao-mini" role="status" data-bp-ext="">{extRaison}</p> : null}
        {ouvrir.map((o) => <p key={o.texte} className="vrm-bp-compte" data-bp-ouvrir={o.n}>{o.texte} pour baisser {o.n > 1 ? `ses ${o.n} annonces` : 'son annonce'}.</p>)}
        {nSous && baisse.ok ? <p className="vrm-ao-mini" data-bp-sous-plancher-n={nSous}>{nSous} sous ton plancher : décochée{nSous > 1 ? 's' : ''}.</p> : null}
        <ul className="vrm-bp-liste" data-bp-n={lignes.length}>
          {lignes.map((l) => {
            const e = etats[l.id] || null;
            const c = coche(l);
            const fini = e && e.etat !== 'envoi' && e.etat !== 'prevue';
            return (
              <li key={l.uid + ':' + l.id} className={'vrm-bp-ligne' + (l.bloque ? ' is-bloque' : '') + (l.sousPlancher ? ' is-sous' : '')} data-bp-ligne={l.id}
                data-bp-coche={c ? '1' : '0'} data-bp-ancien={l.prix == null ? '' : String(l.prix)} data-bp-nouveau={l.nouveau == null ? '' : String(l.nouveau)}
                data-bp-sous-plancher={l.sousPlancher ? '1' : undefined} data-bp-bloque={l.bloque || undefined} data-bp-etat={e ? e.etat : ''}
                data-bp-prix-vu={e && e.prixVu != null ? String(e.prixVu) : undefined}>
                <label className="vrm-bp-case">
                  <input type="checkbox" checked={c} disabled={fige || !!l.bloque || l.nouveau == null} onChange={() => basculer(l)} data-bp-case={l.id} aria-label={`Baisser ${l.numero ? 'le N°' + l.numero : l.titre || 'cette annonce'}`}/>
                  {l.photo && Photo ? <Photo src={l.photo} alt="" className="vrm-bp-photo" loading="lazy"/> : <span className="vrm-bp-photo" aria-hidden="true"/>}
                  <span className="vrm-bp-centre">
                    <span className="vrm-bp-nom">{l.numero ? <b className="vrm-bp-num">N°{l.numero}</b> : null}<span className="vrm-bp-titre">{l.titre || 'Sans titre'}</span></span>
                    <span className="vrm-bp-prix">
                      {/* Après l'envoi, seul le prix RELU s'écrit après la flèche ; pas relu ⇒ « — ». */}
                      {fini && (e.etat === 'fait' || e.etat === 'ecart') ? <><s>{eur(l.prix)}</s> → <b data-bp-relu="">{eur(e.prixVu)}</b><small> {site === 'leboncoin' ? tr('lbcplus.baisse.reluSur') : 'relu sur Vinted'}</small></>
                        : fini && e.etat === 'incertain' ? <><s>{eur(l.prix)}</s> → <b data-bp-relu="">—</b></>
                          : fini ? <b>{eur(e.prixVu != null ? e.prixVu : l.prix)}</b>
                            : l.prix == null ? '—' : <><s>{eur(l.prix)}</s> → <b>{l.nouveau == null ? '—' : eur(l.nouveau)}</b>{varier && l.baisseVue != null && l.nouveau != null ? <small className="vrm-bp-var" data-bp-baisse-vue={String(l.baisseVue)}> −{String(l.baisseVue).replace('.', ',')}{mode === 'pct' ? ' %' : ' €'}</small> : null}</>}
                    </span>
                    {etale && heures[l.id] && c ? <small className="vrm-bp-raison" data-bp-heure={String(heures[l.id])}>Vers {heureFr(heures[l.id])}</small> : null}
                    {l.bloque ? <small className="vrm-bp-raison">{l.bloque}</small>
                      : l.sousPlancher ? <small className="vrm-bp-ambre">Sous ton plancher ({l.plancher.partiel ? 'au moins ' : ''}{eur(l.plancher.centimes / 100)})</small>
                        : l.plancher ? <small className="vrm-bp-raison">Plancher {l.plancher.partiel ? 'au moins ' : ''}{eur(l.plancher.centimes / 100)}</small>
                          : l.raison ? <small className="vrm-bp-raison" data-bp-propose="">{l.raison}</small> : null}
                  </span>
                </label>
                {e ? (
                  <span className={'vrm-ao-etat is-' + (e.etat === 'fait' ? 'fait' : e.etat === 'envoi' || e.etat === 'prevue' ? 'envoi' : 'refuse')} data-bp-etat-txt="">
                    {ETAT[e.etat] || ''}
                    {e.raison && e.etat !== 'fait' ? <small data-bp-raison="">{e.raison}</small> : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {phase === 'envoi' ? (
          <div className="vrm-bp-bas" data-bp-progres={`${progres.i}/${progres.n}`}>
            <span className="vrm-bp-jauge" aria-hidden="true"><i style={{ width: `${progres.n ? Math.round((progres.i / progres.n) * 100) : 0}%` }}/></span>
            <span className="vrm-bp-progres" role="status" aria-live="polite">{progres.i} sur {progres.n}{arretDemande ? ' · arrêt après celle-ci' : ''}</span>
            <button type="button" className="vrm-ao-second" data-bp-arreter="" disabled={arretDemande} onClick={() => { arret.current = true; setArretDemande(true); }}>Arrêter</button>
          </div>
        ) : phase === 'fini' && programme ? (
          <div className="vrm-bp-bas is-fini" data-bp-programme={programme.n}>
            <p className="vrm-bp-progres" role="status">{programme.n} baisse{programme.n > 1 ? 's' : ''} prévue{programme.n > 1 ? 's' : ''} entre {heureFr(programme.de)} et {heureFr(programme.a)}. Garde vinted.fr ouvert.</p>
            <div className="vrm-bp-boutons">
              {onAnnulerProgramme ? <button type="button" className="vrm-ao-second" data-bp-annuler-programme="" onClick={async () => { let r = null; try { r = await onAnnulerProgramme(); } catch (_) { r = null; } if (r && r.accepte) { setProgramme(null); setEtats(Object.fromEntries(Object.keys(etats).map((k) => [k, { etat: 'pas-envoye', raison: 'Annulée par toi' }]))); } }}>Annuler</button> : null}
              <button type="button" className="vrm-ao-principal" data-bp-fermer-fin="" onClick={onFermer}>Fermer</button>
            </div>
          </div>
        ) : phase === 'fini' ? (
          <div className="vrm-bp-bas is-fini" data-bp-bilan={`${bilan.fait}/${bilan.ecart}/${bilan.incertain}/${bilan.echec + bilan.refus}/${bilan.pasEnvoye}`}>
            <p className="vrm-bp-progres" role="status">{[bilan.fait ? `${bilan.fait} baissé${bilan.fait > 1 ? 's' : ''}` : '', bilan.ecart ? `${bilan.ecart} autre prix` : '', bilan.incertain ? `${bilan.incertain} pas relu${bilan.incertain > 1 ? 's' : ''}` : '', (bilan.echec + bilan.refus + bilan.pasEnvoye) ? `${bilan.echec + bilan.refus + bilan.pasEnvoye} pas fait${(bilan.echec + bilan.refus + bilan.pasEnvoye) > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Rien envoyé'}</p>
            <button type="button" className="vrm-ao-principal" data-bp-fermer-fin="" onClick={onFermer}>Fermer</button>
          </div>
        ) : phase === 'confirmer' ? (
          <div className="vrm-bp-bas is-confirmer" data-bp-confirmation={choisies.length}>
            <p className="vrm-bp-progres">{etale ? `Baisser ${choisies.length} prix dans les ${ETALEMENT_H} h ? Une à la fois, à son heure. Garde vinted.fr ouvert.` : `Baisser ${choisies.length} prix sur ${nomSite} ? Une annonce à la fois, depuis l’onglet ${nomSite} ouvert.`}</p>
            <div className="vrm-bp-boutons">
              <button type="button" className="vrm-ao-second" data-bp-annuler="" onClick={() => setPhase('choix')}>Annuler</button>
              <button type="button" className="vrm-ao-principal" data-bp-confirmer="" onClick={lancer}>{etale ? 'Oui, programmer' : 'Oui, baisser'}</button>
            </div>
          </div>
        ) : (
          <div className="vrm-bp-bas">
            <button type="button" className="vrm-ao-principal" data-bp-lancer={choisies.length} disabled={!baisse.ok || !choisies.length || !!extRaison} onClick={demanderConfirmation}>
              {choisies.length ? (etale ? `Programmer ${choisies.length} baisse${choisies.length > 1 ? 's' : ''}` : `Baisser ${choisies.length} prix`) : 'Coche au moins une annonce'}
            </button>
          </div>
        )}
      </div>
    </div>, document.body);
}
