// ── LA FEUILLE « BAISSER LE PRIX » SUR VESTIAIRE (11 nov., lot vestiaire-plus, ext. 5.364) ──
// La même forme que la feuille Vinted (src/BaissePrixSerie.jsx, mêmes classes) ;
// les règles : src/baissePrixVestiaire.js. Rien ne part tant que la recette du
// geste n'est pas APPRISE de SON changement de prix fait à la main sur
// vestiairecollective.com (« Fais-le une fois à la main, VRM apprendra »). Puis :
// il choisit −X € ou −X %, voit ancien → nouveau, coche, confirme ; UNE commande
// `vcPrix` à la fois, le prix RELU affiché, une pause de 3 à 8 s, « Arrêter ».
import React from 'react';
import { createPortal } from 'react-dom';
import { baisseTapee, eurosBaisse as eur } from './baissePrix.js';
import { lignesBaisseVc, issueBaisseVc, etatRecettePrixVc } from './baissePrixVestiaire.js';
import { tr } from './i18n/index.js';
import { suivi } from './suiviTravail.js';   // VRM figé, détail et barre pendant la série (lot suivi-travail)
import './styles-annonces-outils.css';
import './styles-baisse-prix.css';
import './styles-vestiaire-plus.css';

const cc = (x) => String(x || '').replace(/-(\w)/g, (m, c) => c.toUpperCase());
const pauseEntre = () => {
  const f = typeof window !== 'undefined' && window.__VRM_BAISSE_PAUSE;
  if (Number.isFinite(f) && f >= 0) return f;
  return 3000 + Math.floor(Math.random() * 5000);
};

export default function BaissePrixVestiaire({ annonces = [], compteOnglet, recette, cap, onBaisser, onFermer, Photo, Retour }) {
  const [mode, setMode] = React.useState('eur');
  const [texte, setTexte] = React.useState('5');
  const [coches, setCoches] = React.useState(null);
  const [phase, setPhase] = React.useState('choix');
  const [etats, setEtats] = React.useState({});
  const [progres, setProgres] = React.useState({ i: 0, n: 0 });
  const arret = React.useRef(false);
  const baisse = baisseTapee(mode, texte);
  const rec = etatRecettePrixVc(recette, cap);
  const pret = rec.etat === 'pret';
  const lignes = React.useMemo(() => lignesBaisseVc({ annonces, baisse, compteOnglet }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annonces, mode, texte, compteOnglet]);
  const coche = (l) => (coches && Object.prototype.hasOwnProperty.call(coches, l.id) ? coches[l.id] : l.coche) && !l.bloque && l.apres != null;
  const choisies = pret ? lignes.filter(coche) : [];
  const enCours = phase === 'envoi', fige = phase !== 'choix' || !pret;
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  const lancer = async () => {
    const file = choisies.slice();
    if (!file.length || !pret) return;
    arret.current = false;
    setPhase('envoi'); setEtats({}); setProgres({ i: 0, n: file.length });
    // (11 nov.) La feuille commune « VRM travaille » (src/suiviTravail.js) : VRM figé, étapes, barre, journal.
    const t = suivi.demarrer({ sorte: 'baisse-prix-vestiaire', titre: tr('vcBaisse.suivi.titre', { baisse: baisse.mode === 'pct' ? `−${baisse.valeur} %` : `−${baisse.valeur} €` }),
      etapes: [['envoi', tr('vcBaisse.suivi.envoi')], ['relu', tr('vcBaisse.suivi.relu')]], uid: '',
      articles: file.map((l) => ({ id: l.id, num: l.num || '', titre: l.titre || '' })) });
    const poser = (id, e) => setEtats((x) => ({ ...x, [id]: e }));
    let stop = '';
    for (let i = 0; i < file.length; i++) {
      const l = file[i];
      if (t && !(await t.continuer())) arret.current = true;
      if (arret.current) { for (const m of file.slice(i)) { poser(m.id, { etat: 'pas-envoye' }); if (t) t.fin(m.id, { etat: 'saute', raison: tr('vcBaisse.suivi.arrete') }); } break; }
      setProgres({ i: i + 1, n: file.length });
      poser(l.id, { etat: 'envoi' });
      if (t) t.etape(l.id, 'envoi', `${eur(l.avant / 100)} → ${eur(l.apres / 100)}`);
      let r = null; try { r = await onBaisser(l); } catch (_) { r = null; }
      const iss = issueBaisseVc(r);
      poser(l.id, iss);
      if (t) {
        if (iss.etat === 'fait' || iss.etat === 'ecart') t.etape(l.id, 'relu', iss.prixVu != null ? eur(iss.prixVu) : '');
        t.fin(l.id, iss.etat === 'fait' ? { etat: 'ok' }
          : iss.etat === 'ecart' || iss.etat === 'incertain' ? { etat: 'main', raison: iss.raison || tr('vcBaisse.etat.incertain'), geste: tr('vcBaisse.suivi.regarder'), lien: 'https://fr.vestiairecollective.com/' }
          : { etat: 'refus', raison: iss.raison || tr('vcBaisse.etat.refus'), geste: iss.code === 'pas-appris' ? tr('vcBaisse.apprendre.titre') : '' });
      }
      if (iss.arret) { stop = iss.raison || 'refus'; for (const m of file.slice(i + 1)) { poser(m.id, { etat: 'pas-envoye', raison: iss.raison }); if (t) t.fin(m.id, { etat: 'saute', raison: iss.raison }); } break; }
      if (i < file.length - 1) {
        const ms = pauseEntre(); const fin = Date.now() + ms;
        if (t && ms >= 1000) t.pause({ ms, raison: tr('vcBaisse.suivi.pause') });
        while (Date.now() < fin && !arret.current && !(t && t.doitSArreter())) await new Promise((ok) => setTimeout(ok, Math.min(250, Math.max(0, fin - Date.now()))));
        if (t) t.finPause();
      }
    }
    if (t) t.terminer(arret.current ? tr('vcBaisse.suivi.arrete') : stop, stop ? 'arrete' : undefined);
    setPhase('fini');
  };
  const n = (k) => Object.values(etats).filter((e) => e && e.etat === k).length;
  const unite = mode === 'pct' ? '%' : '€';
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile" data-vc-baisse={lignes.length} data-vc-baisse-recette={rec.etat} data-bp-phase={phase} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour fermer={() => { if (!enCours) onFermer(); }}/> : null}
      <div className="vrm-ao-feuille vrm-bp" role="dialog" aria-modal="true" aria-label={tr('vcBaisse.titre')}>
        <header className="vrm-ao-tete">
          <h2>{tr('vcBaisse.titre')}</h2>
          <span className="vrm-ao-num">{tr('vcBaisse.nAnnonces', { n: lignes.length })}</span>
          <button type="button" className="vrm-ao-x" aria-label={tr('commun.fermer')} data-bp-fermer="" onClick={onFermer} disabled={enCours}>×</button>
        </header>
        {!pret ? (
          <div className="vrm-bp-apprendre" data-vc-baisse-apprendre={rec.etat}>
            <p className="vrm-bp-progres"><b>{tr('vcBaisse.apprendre.titre')}</b></p>
            <p className="vrm-bp-note">{rec.etat === 'ext-absente' || rec.etat === 'ext-retard' ? tr('vcBaisse.apprendre.ext', { v: '5.364.0' })
              : rec.etat === 'passu' ? tr('vcBaisse.apprendre.passu')
                : rec.etat === 'pas-sur' ? tr('vcBaisse.apprendre.pasSur', { raison: rec.raison || '—' })
                  : tr('vcBaisse.apprendre.texte')}</p>
            <a className="vrm-pied-lien" data-pied-lien="vc-mes-articles" href="https://fr.vestiairecollective.com/" target="_blank" rel="noreferrer">{tr('vcBaisse.apprendre.ouvrir')}</a>
          </div>
        ) : (
          <div className="vrm-bp-reglage">
            <div className="vrm-bp-modes" role="group" aria-label={tr('vcBaisse.mode')}>
              {[['eur', '− €'], ['pct', '− %']].map(([v, t]) => (
                <button key={v} type="button" className="vrm-bp-mode" aria-pressed={mode === v} data-bp-mode={v} disabled={fige} onClick={() => { setMode(v); setCoches(null); }}>{t}</button>
              ))}
            </div>
            <label className="vrm-bp-champ">
              <span aria-hidden="true">−</span>
              <input inputMode="decimal" autoComplete="off" value={texte} disabled={fige} data-bp-valeur="" aria-label={tr('vcBaisse.valeur', { unite })} onChange={(e) => { setTexte(e.target.value); setCoches(null); }}/>
              <b>{unite}</b>
            </label>
          </div>
        )}
        {pret ? <p className="vrm-bp-note">{tr('vcBaisse.note')}</p> : null}
        {pret && !baisse.ok ? <p className="vrm-ao-mini" role="alert" data-bp-erreur="">{baisse.erreur}</p> : null}
        <ul className="vrm-bp-liste" data-bp-n={lignes.length}>
          {lignes.map((l) => {
            const e = etats[l.id] || null, c = coche(l), fini = e && e.etat !== 'envoi';
            return (
              <li key={l.id} className={'vrm-bp-ligne' + (l.bloque ? ' is-bloque' : '')} data-bp-ligne={l.id} data-bp-coche={c ? '1' : '0'}
                data-bp-ancien={l.avant == null ? '' : String(l.avant / 100)} data-bp-nouveau={l.apres == null ? '' : String(l.apres / 100)} data-bp-bloque={l.bloque || undefined} data-bp-etat={e ? e.etat : ''}
                data-bp-prix-vu={e && e.prixVu != null ? String(e.prixVu) : undefined}>
                <label className="vrm-bp-case">
                  <input type="checkbox" checked={c} disabled={fige || !!l.bloque || l.apres == null} onChange={() => setCoches((x) => ({ ...(x || {}), [l.id]: !c }))} data-bp-case={l.id} aria-label={l.num ? `N°${l.num}` : (l.titre || l.id)}/>
                  {l.photo && Photo ? <Photo src={l.photo} className="vrm-bp-photo"/> : <span className="vrm-bp-photo" aria-hidden="true"/>}
                  <span className="vrm-bp-centre">
                    <span className="vrm-bp-nom">{l.num ? <b className="vrm-bp-num">N°{l.num}</b> : null}<span className="vrm-bp-titre">{l.titre || tr('vcBaisse.sansTitre')}</span></span>
                    <span className="vrm-bp-prix">
                      {fini && (e.etat === 'fait' || e.etat === 'ecart') ? <><s>{eur(l.avant / 100)}</s> → <b data-bp-relu="">{eur(e.prixVu)}</b><small> {tr('vcBaisse.relu')}</small></>
                        : fini && e.etat === 'incertain' ? <><s>{eur(l.avant / 100)}</s> → <b data-bp-relu="">—</b></>
                          : l.avant == null ? '—' : <><s>{eur(l.avant / 100)}</s> → <b>{l.apres == null ? '—' : eur(l.apres / 100)}</b></>}
                    </span>
                    {l.bloque ? <small className="vrm-bp-raison">{tr('vcBaisse.bloque.' + cc(l.bloque))}</small> : null}
                  </span>
                </label>
                {e ? (
                  <span className={'vrm-ao-etat is-' + (e.etat === 'fait' ? 'fait' : e.etat === 'envoi' ? 'envoi' : 'refuse')} data-bp-etat-txt="">
                    {tr('vcBaisse.etat.' + cc(e.etat))}
                    {e.raison && e.etat !== 'fait' ? <small data-bp-raison="">{e.raison}</small> : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {phase === 'envoi' ? (
          <div className="vrm-bp-bas" data-bp-progres={`${progres.i}/${progres.n}`}>
            <span className="vrm-bp-progres" role="status" aria-live="polite">{tr('vcBaisse.progres', { i: progres.i, n: progres.n })}</span>
            <button type="button" className="vrm-ao-second" data-bp-arreter="" onClick={() => { arret.current = true; }}>{tr('vcBaisse.arreter')}</button>
          </div>
        ) : phase === 'fini' ? (
          <div className="vrm-bp-bas is-fini" data-bp-bilan={`${n('fait')}/${n('ecart')}/${n('incertain')}/${n('echec') + n('refus') + n('pas-envoye')}`}>
            <p className="vrm-bp-progres" role="status">{tr('vcBaisse.bilan', { fait: n('fait'), pasRelu: n('incertain') + n('ecart'), pasFait: n('echec') + n('refus') + n('pas-envoye') })}</p>
            <button type="button" className="vrm-ao-principal" data-bp-fermer-fin="" onClick={onFermer}>{tr('commun.fermer')}</button>
          </div>
        ) : phase === 'confirmer' ? (
          <div className="vrm-bp-bas is-confirmer" data-bp-confirmation={choisies.length}>
            <p className="vrm-bp-progres">{tr('vcBaisse.confirmer', { n: choisies.length })}</p>
            <div className="vrm-bp-boutons">
              <button type="button" className="vrm-ao-second" data-bp-annuler="" onClick={() => setPhase('choix')}>{tr('vcBaisse.annuler')}</button>
              <button type="button" className="vrm-ao-principal" data-bp-confirmer="" onClick={lancer}>{tr('vcBaisse.oui')}</button>
            </div>
          </div>
        ) : (
          <div className="vrm-bp-bas">
            <button type="button" className="vrm-ao-principal" data-bp-lancer={choisies.length} disabled={!pret || !baisse.ok || !choisies.length} onClick={() => setPhase('confirmer')}>
              {!pret ? tr('vcBaisse.pasAppris') : choisies.length ? tr('vcBaisse.lancer', { n: choisies.length }) : tr('vcBaisse.cocher')}
            </button>
          </div>
        )}
      </div>
    </div>, document.body);
}
