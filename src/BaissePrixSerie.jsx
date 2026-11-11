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

const ETAT = { envoi: 'Envoi…', fait: 'Fait', ecart: 'Autre prix', incertain: 'Pas relu', echec: 'Refusé', refus: 'Pas envoyée', 'pas-envoye': 'Pas envoyée' };
const pauseEntre = () => {
  const f = typeof window !== 'undefined' && window.__VRM_BAISSE_PAUSE;
  if (Number.isFinite(f) && f >= 0) return f;
  return 3000 + Math.floor(Math.random() * 5000);   // 3 à 8 s entre deux annonces : jamais une rafale
};

export default function BaissePrixSerie({ annonces = [], compteOnglet, plancherDe, extRaison = '', onBaisser, onFermer, onFini, Photo, Retour }) {
  const [mode, setMode] = React.useState('eur');
  const [texte, setTexte] = React.useState('5');
  const [coches, setCoches] = React.useState(null);        // null : les coches par défaut de l'aperçu
  const [phase, setPhase] = React.useState('choix');        // choix · confirmer · envoi · fini
  const [etats, setEtats] = React.useState({});
  const [progres, setProgres] = React.useState({ i: 0, n: 0 });
  const arret = React.useRef(false);
  const [arretDemande, setArretDemande] = React.useState(false);
  const baisse = baisseTapee(mode, texte);
  const lignes = React.useMemo(() => lignesBaisse({ annonces, baisse, compteOnglet, plancherDe }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annonces, mode, texte, compteOnglet, plancherDe]);
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
  const lancer = async () => {
    const file = choisies.slice();                           // figée au clic : l'aperçu qu'il a vu
    if (!file.length || extRaison) return;
    arret.current = false; setArretDemande(false);
    setPhase('envoi'); setEtats({}); setProgres({ i: 0, n: file.length });
    const res = {};
    // (11 nov., Julien : « VRM reste FIGÉ avec le DÉTAIL et une BARRE ») La feuille « VRM travaille ».
    const t = suivi.demarrer({ sorte: 'baisse-prix', titre: `Baisser le prix (${baisse.mode === 'pct' ? `−${baisse.valeur} %` : `−${baisse.valeur} €`})`,
      etapes: [['envoi', 'Envoi du nouveau prix à Vinted'], ['relu', 'Prix relu sur Vinted']], uid: compteOnglet || '',
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
      const iss = issueBaisse(r);
      poser(l.id, iss);
      if (t) {
        if (iss.etat === 'fait' || iss.etat === 'ecart') t.etape(l.id, 'relu', iss.prixVu != null ? eur(iss.prixVu) : '');
        t.fin(l.id, iss.etat === 'fait' ? { etat: 'ok' }
          : iss.etat === 'ecart' || iss.etat === 'incertain' ? { etat: 'main', raison: iss.raison || (iss.etat === 'ecart' ? 'Vinted montre un autre prix' : 'pas relu'), geste: 'Regarde l’annonce sur Vinted' }
          : { etat: 'refus', raison: iss.raison, geste: iss.arret ? 'Attends la fin de la pause de Vinted, puis relance' : '' });
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
        <p className="vrm-bp-note">Arrondi à l’euro. Le prix change sur Vinted, annonce par annonce, puis VRM le relit.</p>
        {compteOnglet ? <div className="vrm-bp-plafond"><JaugeActions uid={compteOnglet} /></div> : null}
        {!baisse.ok ? <p className="vrm-ao-mini" role="alert" data-bp-erreur="">{baisse.erreur}</p> : null}
        {extRaison ? <p className="vrm-ao-mini" role="status" data-bp-ext="">{extRaison}</p> : null}
        {ouvrir.map((o) => <p key={o.texte} className="vrm-bp-compte" data-bp-ouvrir={o.n}>{o.texte} pour baisser {o.n > 1 ? `ses ${o.n} annonces` : 'son annonce'}.</p>)}
        {nSous && baisse.ok ? <p className="vrm-ao-mini" data-bp-sous-plancher-n={nSous}>{nSous} sous ton plancher : décochée{nSous > 1 ? 's' : ''}.</p> : null}
        <ul className="vrm-bp-liste" data-bp-n={lignes.length}>
          {lignes.map((l) => {
            const e = etats[l.id] || null;
            const c = coche(l);
            const fini = e && e.etat !== 'envoi';
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
                      {fini && (e.etat === 'fait' || e.etat === 'ecart') ? <><s>{eur(l.prix)}</s> → <b data-bp-relu="">{eur(e.prixVu)}</b><small> relu sur Vinted</small></>
                        : fini && e.etat === 'incertain' ? <><s>{eur(l.prix)}</s> → <b data-bp-relu="">—</b></>
                          : fini ? <b>{eur(e.prixVu != null ? e.prixVu : l.prix)}</b>
                            : l.prix == null ? '—' : <><s>{eur(l.prix)}</s> → <b>{l.nouveau == null ? '—' : eur(l.nouveau)}</b></>}
                    </span>
                    {l.bloque ? <small className="vrm-bp-raison">{l.bloque}</small>
                      : l.sousPlancher ? <small className="vrm-bp-ambre">Sous ton plancher ({l.plancher.partiel ? 'au moins ' : ''}{eur(l.plancher.centimes / 100)})</small>
                        : l.plancher ? <small className="vrm-bp-raison">Plancher {l.plancher.partiel ? 'au moins ' : ''}{eur(l.plancher.centimes / 100)}</small> : null}
                  </span>
                </label>
                {e ? (
                  <span className={'vrm-ao-etat is-' + (e.etat === 'fait' ? 'fait' : e.etat === 'envoi' ? 'envoi' : 'refuse')} data-bp-etat-txt="">
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
        ) : phase === 'fini' ? (
          <div className="vrm-bp-bas is-fini" data-bp-bilan={`${bilan.fait}/${bilan.ecart}/${bilan.incertain}/${bilan.echec + bilan.refus}/${bilan.pasEnvoye}`}>
            <p className="vrm-bp-progres" role="status">{[bilan.fait ? `${bilan.fait} baissé${bilan.fait > 1 ? 's' : ''}` : '', bilan.ecart ? `${bilan.ecart} autre prix` : '', bilan.incertain ? `${bilan.incertain} pas relu${bilan.incertain > 1 ? 's' : ''}` : '', (bilan.echec + bilan.refus + bilan.pasEnvoye) ? `${bilan.echec + bilan.refus + bilan.pasEnvoye} pas fait${(bilan.echec + bilan.refus + bilan.pasEnvoye) > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Rien envoyé'}</p>
            <button type="button" className="vrm-ao-principal" data-bp-fermer-fin="" onClick={onFermer}>Fermer</button>
          </div>
        ) : phase === 'confirmer' ? (
          <div className="vrm-bp-bas is-confirmer" data-bp-confirmation={choisies.length}>
            <p className="vrm-bp-progres">Baisser {choisies.length} prix sur Vinted ? Une annonce à la fois, depuis l’onglet Vinted ouvert.</p>
            <div className="vrm-bp-boutons">
              <button type="button" className="vrm-ao-second" data-bp-annuler="" onClick={() => setPhase('choix')}>Annuler</button>
              <button type="button" className="vrm-ao-principal" data-bp-confirmer="" onClick={lancer}>Oui, baisser</button>
            </div>
          </div>
        ) : (
          <div className="vrm-bp-bas">
            <button type="button" className="vrm-ao-principal" data-bp-lancer={choisies.length} disabled={!baisse.ok || !choisies.length || !!extRaison} onClick={() => setPhase('confirmer')}>
              {choisies.length ? `Baisser ${choisies.length} prix` : 'Coche au moins une annonce'}
            </button>
          </div>
        )}
      </div>
    </div>, document.body);
}
