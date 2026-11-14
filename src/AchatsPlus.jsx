// ══════════════════════════════════════════════════════════════════════════════
//  ACHATS, EN PLUS (14 nov., lot messages-achats-plus : 111, 125, 131)
// ══════════════════════════════════════════════════════════════════════════════
// Un groupe de trois rangées sous la liste d'Achats (à côté de « Tes meilleures
// sources ») — la liste d'abord (AJOUT 3) :
//   · « Même annonce achetée deux fois » (131) — seulement s'il y en a, point ambre ;
//     la feuille montre chaque groupe (par l'identifiant Vinted exact) ; rien n'est masqué ;
//   · « Carnet des vendeurs » (125) — chez qui il achète, lu à l'ouverture ;
//   · « Ta liste de recherche » (111) — ce qu'il cherche ; l'encart VRM sur Vinted le
//     signale sur l'annonce ouverte (extension 5.376).
// Les règles : src/achatMemeAnnonce.js, src/carnetVendeurs.js, src/listeRecherche.js.
// Les données et les gestes viennent d'App.jsx (props) : ce fichier ne lit rien seul.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { tr } from './i18n/index.js';
import { Feuille } from './ui/Feuille.jsx';
import { Ligne } from './ui/Ligne.jsx';
import { groupesMemeAnnonce } from './achatMemeAnnonce.js';
import { carnetVendeurs } from './carnetVendeurs.js';
import { listePropre, resumeRecherche, rechercheNette } from './listeRecherche.js';
import './styles-aide-reponse.css';

const eur = (c) => (c == null || !Number.isFinite(c) ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(c / 100)));
const signe = (c) => (c > 0 ? '+' : c < 0 ? '−' : '') + eur(Math.abs(c));
const jourCourt = (d) => { const t = Date.parse(String(d || '').length === 10 ? d + 'T12:00:00' : d); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
const Icone = ({ d }) => <span className="vrm-plus-icone" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg></span>;
const pl = (cle, n, vars = {}) => tr(cle, { n, ...vars });

// ── 131 : la feuille des annonces achetées deux fois ─────────────────────────
function FeuilleDoubles({ groupes, carte, achatParTx, nomCompte, onClose }) {
  return (
    <Feuille titre={tr('plus.double.titre')} onClose={onClose} data-feuille-doubles="" className="vrm-ui-feuille vrm-plus-feuille">
      <p className="vrm-plus-desc">{tr('plus.double.desc')}</p>
      {carte ? <p className="vrm-plus-couv" data-doubles-couverture={`${carte.connus}/${carte.total}`}>{tr('plus.double.couverture', { n: carte.connus, total: carte.total })}</p> : null}
      {!groupes.length ? <p className="vrm-plus-vide">{tr('plus.double.aucun')}</p> : groupes.map((g) => (
        <section key={g.item} data-double-item={g.item}>
          <h3 className="vrm-plus-entete">{tr('plus.double.annonce', { id: g.item })}</h3>
          <div className="vrm-plus-groupe">
            {g.achats.map((a) => { const o = achatParTx.get(a.tx); return (
              <Ligne key={a.tx} photo={o && o.photo ? o.photo : undefined} titre={(o && o.title) || `#${a.tx}`} sous={[jourCourt(a.d), nomCompte ? nomCompte(a.c) : ''].filter(Boolean).join(' · ')} data-double-tx={a.tx}/>
            ); })}
          </div>
        </section>
      ))}
    </Feuille>
  );
}

// ── 125 : le carnet des vendeurs ────────────────────────────────────────────
function FeuilleCarnet({ achats, lireVendeurs, bilan, estAnnule, montant, onClose }) {
  const [lu, setLu] = useState(undefined);   // undefined en cours · null pas su · { vendeurs, etats }
  const [essai, setEssai] = useState(0);
  const [ouvert, setOuvert] = useState('');
  useEffect(() => {
    let mort = false;
    setLu(undefined);
    Promise.resolve(typeof lireVendeurs === 'function' ? lireVendeurs() : null).then((r) => { if (!mort) setLu(r && r.vendeurs instanceof Map ? r : null); }).catch(() => { if (!mort) setLu(null); });
    return () => { mort = true; };
  }, [essai]);
  const c = useMemo(() => (lu ? carnetVendeurs({ achats, vendeurs: lu.vendeurs, etats: lu.etats || {}, bilan, estAnnule, montant }) : null), [lu, achats, bilan, estAnnule, montant]);
  return (
    <Feuille titre={tr('plus.carnet.titre')} onClose={onClose} data-feuille-carnet={lu === undefined ? 'lecture' : lu === null ? 'pas-su' : 'lu'} className="vrm-ui-feuille vrm-plus-feuille">
      {lu === undefined ? <p className="vrm-plus-vide" role="status">{tr('plus.carnet.lecture')}</p> : null}
      {lu === null ? <p className="vrm-plus-vide" role="alert">{tr('plus.carnet.pasSu')} <button type="button" className="vrm-plus-lien" onClick={() => setEssai((n) => n + 1)}>{tr('plus.carnet.reessayer')}</button></p> : null}
      {c ? <>
        <p className="vrm-plus-couv" data-carnet-couverture={`${c.avecVendeur}/${c.total}`} title={tr('plus.carnet.pourquoi')}>{tr('plus.carnet.couverture', { n: c.avecVendeur, total: c.total })}</p>
        {!c.vendeurs.length ? <p className="vrm-plus-vide">{tr('plus.carnet.aucun')}</p> : (
          <div className="vrm-plus-groupe vrm-plus-liste" data-carnet-liste="">
            {c.vendeurs.slice(0, 200).map((v) => {
              const sous = [pl('plus.carnet.achats', v.achats), v.revendus ? pl('plus.carnet.revendus', v.revendus) : '', v.delaiJours != null ? tr('plus.carnet.recu', { j: v.delaiJours }) : '', v.nSoucis ? pl('plus.carnet.soucis', v.nSoucis) : ''].filter(Boolean).join(' · ');
              const val = v.benefice == null ? '' : (v.partiel ? tr('plus.carnet.auPlus', { v: signe(v.benefice) }) : signe(v.benefice));
              return (<React.Fragment key={v.id}>
                <Ligne titre={v.login || tr('plus.carnet.vendeur', { id: v.id })} sous={sous} valeur={val} onClick={() => setOuvert(ouvert === v.id ? '' : v.id)}
                  aria-expanded={ouvert === v.id} data-carnet-vendeur={v.id} data-carnet-benefice={v.benefice == null ? '' : String(v.benefice)} data-carnet-achats={String(v.achats)}/>
                {ouvert === v.id ? <div className="vrm-plus-couv" style={{ padding: '4px 12px 12px', margin: 0 }} data-carnet-detail={v.id}>
                  <div>{tr('plus.carnet.investi', { v: v.investi == null ? '—' : (v.auMoins ? tr('plus.carnet.auMoins', { v: eur(v.investi) }) : eur(v.investi)) })}</div>
                  {v.benefice != null ? <div>{tr('plus.carnet.beneficeSur', { n: v.nBenef, total: v.revendus })}</div> : null}
                  {v.nSoucis ? <div>{tr('plus.carnet.detailSoucis', { a: v.soucis.annule, r: v.soucis.retour, s: v.soucis.suspendu, e: v.soucis.echec })}</div> : null}
                </div> : null}
              </React.Fragment>);
            })}
          </div>
        )}
        <p className="vrm-plus-couv" style={{ marginTop: 12 }}>{tr('plus.carnet.pourquoi')}</p>
      </> : null}
    </Feuille>
  );
}

// ── 111 : la liste de recherche ─────────────────────────────────────────────
function FeuilleRecherche({ liste, onChanger, extEtat, extVersion, onClose }) {
  const [marque, setMarque] = useState(''); const [modele, setModele] = useState(''); const [tailles, setTailles] = useState(''); const [prixMax, setPrixMax] = useState('');
  const propre = listePropre(liste);
  const brouillon = rechercheNette({ id: 'x', marque, modele, tailles, prixMax });
  const ajouter = () => {
    if (!brouillon) return;
    const id = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    onChanger([...propre, { ...brouillon, id }]);
    setMarque(''); setModele(''); setTailles(''); setPrixMax('');
  };
  return (
    <Feuille titre={tr('plus.recherche.titre')} onClose={onClose} data-feuille-recherche={String(propre.length)} className="vrm-ui-feuille vrm-plus-feuille">
      <p className="vrm-plus-desc">{tr('plus.recherche.desc')}</p>
      {extEtat && extEtat !== 'ok' ? <p className="vrm-plus-couv" data-recherche-ext={extEtat}><span className="vrm-plus-point" aria-hidden="true"/>{tr('plus.recherche.ext', { v: extVersion })}</p> : null}
      {propre.length ? <div className="vrm-plus-groupe" data-recherche-liste="">
        {propre.map((r) => (
          <Ligne key={r.id} titre={[r.marque, r.modele].filter(Boolean).join(' · ')} sous={resumeRecherche({ ...r, marque: '', modele: '' }).replace(/^ · /, '') || ' '} data-recherche-id={r.id}
            chevron={false}>
            <button type="button" className="vrm-plus-lien" data-recherche-retirer={r.id} onClick={() => onChanger(propre.filter((x) => x.id !== r.id))}>{tr('plus.recherche.retirer')}</button>
          </Ligne>
        ))}
      </div> : <p className="vrm-plus-vide">{tr('plus.recherche.aucune')}</p>}
      <h3 className="vrm-plus-entete">{tr('plus.recherche.nouvelle')}</h3>
      <label className="vrm-plus-champ">{tr('plus.recherche.marque')}<input data-recherche-champ="marque" value={marque} maxLength={40} placeholder="Nike" onChange={(e) => setMarque(e.target.value)}/></label>
      <label className="vrm-plus-champ">{tr('plus.recherche.modele')}<input data-recherche-champ="modele" value={modele} maxLength={80} placeholder="air max 90" onChange={(e) => setModele(e.target.value)}/></label>
      <label className="vrm-plus-champ">{tr('plus.recherche.tailles')}<input data-recherche-champ="tailles" value={tailles} maxLength={60} placeholder="42,5 / 43" onChange={(e) => setTailles(e.target.value)}/></label>
      <label className="vrm-plus-champ">{tr('plus.recherche.prixMax')}<input data-recherche-champ="prix" inputMode="decimal" value={prixMax} maxLength={7} placeholder="80" onChange={(e) => setPrixMax(e.target.value)}/></label>
      {(marque || modele || tailles || prixMax) && !brouillon ? <p className="vrm-plus-erreur" role="status">{tr('plus.recherche.trop')}</p> : null}
      <div className="vrm-plus-actions">
        <button type="button" className="vrm-plus-principal" data-recherche-ajouter="" disabled={!brouillon || propre.length >= 50} onClick={ajouter}>{tr('plus.recherche.ajouter')}</button>
      </div>
    </Feuille>
  );
}

export default function AchatsPlus({ achats = [], carte = null, achatParTx = new Map(), nomCompte = null, lireVendeurs = null, lireBilan = null, estAnnule = null, montant = null,
  liste = [], onChangerListe = null, extEtat = 'ok', extVersion = '' }) {
  const [feuille, setFeuille] = useState('');
  const groupes = useMemo(() => groupesMemeAnnonce(carte), [carte]);
  const nListe = listePropre(liste).length;
  return (
    <section className="vrm-achats-plus" data-achats-plus="" aria-label={tr('plus.achats.titre')}>
      <h2 className="vrm-plus-entete" style={{ marginTop: 24 }}>{tr('plus.achats.titre')}</h2>
      <div className="vrm-plus-groupe">
        {groupes.length ? <Ligne titre={tr('plus.double.ligne')} sous={pl('plus.double.sous', groupes.length)} geste valeur={String(groupes.length)} onClick={() => setFeuille('doubles')} data-achats-doubles={String(groupes.length)}
          photo={undefined}/> : null}
        <button type="button" className="vrm-ui-ligne" data-achats-carnet="" onClick={() => setFeuille('carnet')}>
          <Icone d={<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2 3 4.4"/></>}/>
          <span className="vrm-ui-ligne-textes"><span className="vrm-ui-ligne-titre"><span>{tr('plus.carnet.ligne')}</span></span><span className="vrm-ui-ligne-sous">{tr('plus.carnet.sous')}</span></span>
          <svg className="vrm-ui-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="vrm-ui-ligne" data-achats-recherche={String(nListe)} onClick={() => setFeuille('recherche')}>
          <Icone d={<><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>}/>
          <span className="vrm-ui-ligne-textes"><span className="vrm-ui-ligne-titre"><span>{tr('plus.recherche.ligne')}</span></span><span className="vrm-ui-ligne-sous">{nListe ? pl('plus.recherche.sous', nListe) : tr('plus.recherche.sousVide')}</span></span>
          <svg className="vrm-ui-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      {feuille === 'doubles' ? <FeuilleDoubles groupes={groupes} carte={carte} achatParTx={achatParTx} nomCompte={nomCompte} onClose={() => setFeuille('')}/> : null}
      {feuille === 'carnet' ? <FeuilleCarnet achats={achats} lireVendeurs={lireVendeurs} bilan={typeof lireBilan === 'function' ? lireBilan() : null} estAnnule={estAnnule} montant={montant} onClose={() => setFeuille('')}/> : null}
      {feuille === 'recherche' ? <FeuilleRecherche liste={liste} onChanger={(l) => onChangerListe && onChangerListe(l)} extEtat={extEtat} extVersion={extVersion} onClose={() => setFeuille('')}/> : null}
    </section>
  );
}
