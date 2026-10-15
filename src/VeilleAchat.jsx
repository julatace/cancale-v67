// src/VeilleAchat.jsx — eBay → « Veille » : la veille d'achat et la rentabilité
// avant achat (15 octobre). La RÈGLE vit dans api/_lib/veille-regle.js (la même
// que le serveur exécute) ; cet écran la montre, il ne la refait pas (§11).
//
// Ce que l'écran ne fait JAMAIS : acheter, payer, enchérir, envoyer une offre.
// Le seul geste vers eBay est un LIEN « Voir sur eBay ». Vinted et Leboncoin
// sont dits « non surveillés » — aucun accès autorisé (CLAUDE.md §3).
import React, { useEffect, useMemo, useState } from 'react';
import { appelerEbay } from './ebayRequetes.js';
import {
  rentabilite, ventesComparables, fourchetteRevente, budgetDuMois, taillesDuTitre, centimesDe, eurosTexte,
  ETATS_VEILLE, MOTIFS_REFUS, COMPARABLES_MIN, VEILLE_MAX_RECHERCHES,
} from '../api/_lib/veille-regle.js';

const eur = eurosTexte;
const ilYa = (t, maintenant) => {
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((maintenant - t) / 60000));
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const enEuros = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, ''));
const DRAPEAUX = { lot: 'lot', 'plusieurs-pointures': 'plusieurs pointures dans le titre', encheres: 'enchère : le prix peut monter', 'sans-photo': 'sans photo' };
const ORDRES = { cout: 'Coût total', date: 'Plus récentes' };

function styles(C) {
  const bouton = { minHeight: 34, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
  return {
    carte: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: C.shadow || 'none', minWidth: 0 },
    bouton,
    principal: { ...bouton, background: C.accent, borderColor: C.accent, color: C.onAccent || '#fff' },
    champ: { width: '100%', minHeight: 38, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontFamily: 'inherit', fontSize: 16, boxSizing: 'border-box' },
    etiquette: { display: 'grid', gap: 5, fontSize: 12, color: C.muted, minWidth: 0 },
    muet: { fontSize: 12, color: C.muted, lineHeight: 1.5 },
    titre: { fontSize: 14, fontWeight: 700, color: C.text, margin: 0 },
    pastille: { display: 'inline-block', fontSize: 11, padding: '2px 7px', borderRadius: 999, border: `1px solid ${C.border}`, color: C.muted, marginRight: 5, marginTop: 4 },
  };
}

// ── RENTABILITÉ AVANT ACHAT ──────────────────────────────────────────────────
// Un prix d'achat saisi ⇒ le bénéfice estimé après les coûts CONNUS (et ce qui
// manque, nommé à côté) ; un bénéfice voulu ⇒ le prix maximum à payer. La
// fourchette de revente ne vient QUE de ses ventes du même modèle et de la même
// pointure — sinon « pas assez de ventes comparables ».
export function Rentabilite({ C, cle: cleFixe, titreInitial = '', achatInit = null, livraisonInit = null, ventes, modeleDe, maintenant = Date.now(), attr = 'annonce' }) {
  const S = styles(C);
  const [libre, setLibre] = useState(titreInitial);
  const [v, setV] = useState({ achat: enEuros(achatInit), livraison: enEuros(livraisonInit), remise: '', frais: '', revente: '', marge: '' });
  const [voirVentes, setVoirVentes] = useState(false);
  const cle = useMemo(() => {
    if (cleFixe !== undefined) return cleFixe;
    const modele = typeof modeleDe === 'function' ? modeleDe(libre) : null;
    const { eu } = taillesDuTitre(libre);
    return modele && eu.length === 1 ? { modele, taille: eu[0] } : null;
  }, [cleFixe, libre, modeleDe]);
  const comparables = useMemo(() => (Array.isArray(ventes) && cle ? ventesComparables(ventes, cle, modeleDe) : []), [ventes, cle, modeleDe]);
  const f = useMemo(() => fourchetteRevente(comparables, maintenant), [comparables, maintenant]);
  const c = (k) => centimesDe(v[k]);
  const res = rentabilite({ achat: c('achat'), livraison: c('livraison'), remise: c('remise'), frais: c('frais'), revente: c('revente'), marge: c('marge') });
  const scen = f.assez && c('achat') != null ? ['prudente', 'moyenne', 'ambitieuse'].map((k) => [k, rentabilite({ achat: c('achat'), livraison: c('livraison'), remise: c('remise'), frais: c('frais'), revente: f[k] }).benefice]) : null;
  const champ = (k, lib, ph) => (
    <label style={S.etiquette}>{lib}
      <input inputMode="decimal" value={v[k]} placeholder={ph} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={S.champ} data-renta-champ={k}/>
    </label>
  );
  return (
    <div data-rentabilite={attr} style={{ display: 'grid', gap: 10 }}>
      {cleFixe === undefined && (
        <label style={S.etiquette}>Modèle et pointure
          <input value={libre} placeholder="ex. Adidas Spezial 42" onChange={(e) => setLibre(e.target.value)} style={S.champ} data-renta-champ="libre"/>
        </label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8 }}>
        {champ('achat', 'Prix d\'achat', '€')}
        {champ('livraison', 'Livraison', 'inconnue')}
        {champ('remise', 'Remise en état', '€')}
        {champ('frais', 'Frais de vente', '€')}
        {champ('revente', 'Revente', '€')}
        {champ('marge', 'Bénéfice voulu', '€')}
      </div>
      <div data-comparables={ventes === undefined ? 'lecture' : ventes === null ? 'pas-su' : !cle ? 'sans-cle' : f.assez ? 'assez' : 'trop-peu'} data-n={f.n} style={S.muet}>
        {ventes === undefined ? 'Lecture de tes ventes…'
          : ventes === null ? 'Tes ventes n\'ont pas pu être lues : pas de fourchette de revente.'
            : !cle ? 'Modèle ou pointure non reconnus : pas de ventes comparables.'
              : !f.assez ? `Pas assez de ventes comparables (${f.n} sur ${COMPARABLES_MIN}) — ${cle.modele} en ${cle.taille}.`
                : (<>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {['prudente', 'moyenne', 'ambitieuse'].map((k) => (
                      <button key={k} type="button" style={S.bouton} onClick={() => setV({ ...v, revente: enEuros(f[k]) })} data-scenario={k}>
                        {k[0].toUpperCase() + k.slice(1)} · {eur(f[k])}
                      </button>
                    ))}
                  </span>
                  {f.n} vente{f.n > 1 ? 's' : ''} de {cle.modele} en {cle.taille}, la plus récente {f.plusRecenteJ === 0 ? 'aujourd\'hui' : `il y a ${f.plusRecenteJ} j`}{f.anciennes ? ' — anciennes, prudence' : ''}.{' '}
                  <button type="button" onClick={() => setVoirVentes(!voirVentes)} style={{ ...S.bouton, minHeight: 0, padding: '2px 8px', fontSize: 11.5 }}>{voirVentes ? 'Masquer' : 'Voir'} les ventes</button>
                  {voirVentes && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }} data-comparables-liste="">
                      {comparables.slice(0, 20).map((x, i) => <li key={i}>{x.date ? new Date(x.date).toLocaleDateString('fr-FR') : 'date inconnue'} · {eur(x.prix)} · {x.titre}</li>)}
                    </ul>
                  )}
                </>)}
      </div>
      {scen && (
        <div data-scenarios="" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
          {scen.map(([k, b]) => (
            <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 8px', minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.muted }}>{k[0].toUpperCase() + k.slice(1)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }} data-scenario-benefice={k}>{b == null ? '—' : eur(b)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gap: 3, fontSize: 13, color: C.text }}>
        <div data-benefice={res.benefice == null ? '' : res.benefice}>
          Bénéfice estimé : <b>{res.benefice == null ? '—' : eur(res.benefice)}</b>
          {res.margePct != null && <span style={{ color: C.muted }}> · {String(res.margePct).replace('.', ',')} %</span>}
          {res.benefice == null && <span style={{ color: C.muted }}> — saisis le prix d'achat et la revente</span>}
        </div>
        {res.benefice != null && !res.complet && <div style={S.muet} data-benefice-manque="">Sans {res.manquants.join(', ')} (non saisi{res.manquants.length > 1 ? 's' : ''}).</div>}
        {res.prixMax != null && (
          <div data-prix-max={res.prixMax} data-prix-max-porte={res.prixMaxPorte}>
            {res.prixMaxPorte === 'article' ? 'Prix d\'achat maximum' : 'Coût maximum, livraison comprise'} : <b>{res.prixMax < 0 ? 'aucun (revente trop basse)' : eur(res.prixMax)}</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LE FORMULAIRE D'UNE RECHERCHE ────────────────────────────────────────────
const VIDE = { nom: '', marque: '', modele: '', autres: '', tailles: '', etats: [], prixMaxEuros: '', motsExclus: '', lots: 'exclure', encheres: 'non', pays: '', arreterQuandAchetee: false };
const versFormulaire = (r) => ({
  ...VIDE, id: r.id, nom: r.nom || '', marque: r.marque || '', modele: (r.noms || [])[0] || '', autres: (r.noms || []).slice(1).join(', '),
  tailles: (r.tailles || []).join(', '), etats: r.etats || [], prixMaxEuros: enEuros(r.prixMax), motsExclus: (r.motsExclus || []).join(', '),
  lots: r.lots || 'exclure', encheres: r.encheres || 'non', pays: r.pays || '', arreterQuandAchetee: !!r.arreterQuandAchetee, alerte: !!r.alerte, pause: !!r.pause,
});
const versRecherche = (f) => ({
  ...(f.id ? { id: f.id } : {}), nom: f.nom, marque: f.marque, noms: [f.modele, ...String(f.autres || '').split(',')].map((x) => x.trim()).filter(Boolean),
  tailles: String(f.tailles || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean), etats: f.etats, prixMaxEuros: f.prixMaxEuros,
  motsExclus: f.motsExclus, lots: f.lots, encheres: f.encheres, pays: f.pays, arreterQuandAchetee: !!f.arreterQuandAchetee, alerte: !!f.alerte, pause: !!f.pause,
});

function Formulaire({ C, initial, onAnnuler, onEnregistrer, onTester, occupe, erreur }) {
  const S = styles(C);
  const [f, setF] = useState(initial);
  const m = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const choix = (k, opts) => (
    <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opts.map(([val, lib]) => (
        <button key={val} type="button" role="radio" aria-checked={f[k] === val} onClick={() => setF({ ...f, [k]: val })}
          style={f[k] === val ? { ...S.bouton, borderColor: C.accent, color: C.accent } : S.bouton}>{lib}</button>
      ))}
    </div>
  );
  return (
    <form data-veille-form={f.id ? 'modifier' : 'nouvelle'} style={{ ...S.carte, display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); onEnregistrer(versRecherche(f)); }}>
      <h3 style={S.titre}>{f.id ? 'Modifier la recherche' : 'Nouvelle recherche'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        <label style={S.etiquette}>Marque<input value={f.marque} onChange={m('marque')} placeholder="ex. Adidas" style={S.champ} data-champ="marque"/></label>
        <label style={S.etiquette}>Modèle<input value={f.modele} onChange={m('modele')} placeholder="ex. Spezial" style={S.champ} data-champ="modele" required/></label>
        <label style={S.etiquette}>Autres noms du modèle<input value={f.autres} onChange={m('autres')} placeholder="ex. Handball Spezial" style={S.champ} data-champ="autres"/></label>
        <label style={S.etiquette}>Pointures<input value={f.tailles} onChange={m('tailles')} placeholder="ex. 42, 42 2/3" style={S.champ} data-champ="tailles"/></label>
        <label style={S.etiquette}>Prix maximum, livraison comprise<input inputMode="decimal" value={f.prixMaxEuros} onChange={m('prixMaxEuros')} placeholder="ex. 60" style={S.champ} data-champ="prix" required/></label>
        <label style={S.etiquette}>Mots exclus<input value={f.motsExclus} onChange={m('motsExclus')} placeholder="ex. enfant, abîmé" style={S.champ} data-champ="exclus"/></label>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={S.etiquette}>États acceptés
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(ETATS_VEILLE).map(([k, e]) => {
              const on = f.etats.includes(k);
              return <button key={k} type="button" aria-pressed={on} onClick={() => setF({ ...f, etats: on ? f.etats.filter((x) => x !== k) : [...f.etats, k] })} style={on ? { ...S.bouton, borderColor: C.accent, color: C.accent } : S.bouton}>{e.nom}</button>;
            })}
            <span style={{ ...S.muet, alignSelf: 'center' }}>{f.etats.length ? '' : 'aucun choisi : tous'}</span>
          </div>
        </div>
        <div style={S.etiquette}>Lots{choix('lots', [['exclure', 'Sans lots'], ['accepter', 'Accepter'], ['seulement', 'Seulement des lots']])}</div>
        <div style={S.etiquette}>Format{choix('encheres', [['non', 'Prix fixe'], ['aussi', 'Aussi les enchères']])}</div>
        <div style={S.etiquette}>Vendeur{choix('pays', [['', 'Partout'], ['FR', 'En France']])}</div>
        <label style={{ ...S.muet, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={!!f.arreterQuandAchetee} onChange={(e) => setF({ ...f, arreterQuandAchetee: e.target.checked })}/>
          Mettre en pause quand je marque une annonce « achetée »
        </label>
      </div>
      {erreur && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: C.warn }} data-veille-erreur="">{erreur}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="submit" style={S.principal} disabled={occupe} data-enregistrer="">Enregistrer</button>
        <button type="button" style={S.bouton} disabled={occupe} onClick={() => onTester(versRecherche(f))} data-tester="">Tester sans enregistrer</button>
        <button type="button" style={S.bouton} onClick={onAnnuler}>Annuler</button>
      </div>
    </form>
  );
}

// ── UNE ANNONCE TROUVÉE ──────────────────────────────────────────────────────
function Annonce({ C, a, verifAt, maintenant, lectureSeule, onDecision, ventes, modeleDe, occupe }) {
  const S = styles(C);
  const [refus, setRefus] = useState(false);
  const [note, setNote] = useState(null);
  const [renta, setRenta] = useState(false);
  const cle = useMemo(() => {
    const modele = typeof modeleDe === 'function' ? modeleDe(a.titre) : null;
    const { eu } = taillesDuTitre(a.titre);
    return modele && eu.length === 1 ? { modele, taille: eu[0] } : null;
  }, [a.titre, modeleDe]);
  const pasRevue = !lectureSeule && Number.isFinite(verifAt) && Number.isFinite(a.revuLe) && a.revuLe < verifAt;
  const prix = a.livraison != null
    ? <>{eur(a.prix)} + {eur(a.livraison)} livraison = <b>{eur(a.total)}</b></>
    : <><b>{eur(a.prix)}</b> · livraison inconnue — total non confirmé</>;
  const statutTxt = { 'a-examiner': 'À examiner', achetee: 'Achetée', refusee: `Refusée${a.motif ? ' · ' + (MOTIFS_REFUS[a.motif] || a.motif) : ''}` }[a.statut];
  const dec = (statut, extra) => onDecision(a.id, { statut, ...(extra || {}) });
  return (
    <div data-annonce={a.id} data-statut={a.statut} data-total-confirme={a.totalConfirme ? '1' : '0'} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr)', gap: 10, padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
      {a.image
        ? <img src={a.image} alt="" loading="lazy" width="56" height="56" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: C.card2 }}/>
        : <div style={{ width: 56, height: 56, borderRadius: 8, background: C.card2, fontSize: 10, color: C.muted, display: 'grid', placeItems: 'center', textAlign: 'center' }}>sans photo</div>}
      <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: C.text, fontSize: 13.5, fontWeight: 600, textDecoration: 'none', overflowWrap: 'anywhere' }} data-lien-ebay="">{a.titre} ↗</a>
        <div style={{ fontSize: 13, color: C.text }} data-prix="">{prix}</div>
        <div style={S.muet}>
          {[a.etat || 'état non indiqué', a.pays ? `vendeur en ${a.pays}` : '', a.vendeur && a.vendeur.pct != null ? `${String(a.vendeur.pct).replace('.', ',')} % d'avis positifs (eBay)` : '', a.offre ? 'offre possible sur eBay' : ''].filter(Boolean).join(' · ')}
        </div>
        {(a.raisons || []).length > 0 && <div style={S.muet} data-pourquoi="">Pourquoi : {a.raisons.join(' · ')}</div>}
        {(a.inverifiables || []).length > 0 && <div style={S.muet} data-inverifiable="">Non vérifié : {a.inverifiables.join(' · ')}</div>}
        <div>
          {statutTxt && <span style={{ ...S.pastille, color: C.text }} data-statut-txt="">{statutTxt}</span>}
          {(a.drapeaux || []).map((d) => <span key={d} style={S.pastille} data-drapeau={d}>{DRAPEAUX[d] || d}</span>)}
          {pasRevue && <span style={S.pastille} data-drapeau="pas-revue">pas revue à la dernière vérification</span>}
          {Number.isFinite(a.revuLe) && maintenant - a.revuLe > 6 * 3600000 && <span style={S.pastille} data-drapeau="ancien">prix lu {ilYa(a.revuLe, maintenant)}</span>}
        </div>
        {a.note && note == null && <div style={{ ...S.muet, fontStyle: 'italic' }} data-note="">« {a.note} »</div>}
        {!lectureSeule && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {a.statut === 'nouvelle' && <button type="button" style={S.bouton} disabled={occupe} onClick={() => dec('a-examiner')} data-decision="a-examiner">À examiner</button>}
            {a.statut !== 'achetee' && a.statut !== 'refusee' && <button type="button" style={S.bouton} disabled={occupe} onClick={() => dec('achetee')} data-decision="achetee">Je l'ai achetée</button>}
            {a.statut !== 'refusee' && !refus && <button type="button" style={S.bouton} disabled={occupe} onClick={() => setRefus(true)} data-decision="refuser">Refuser</button>}
            {a.statut !== 'nouvelle' && <button type="button" style={S.bouton} disabled={occupe} onClick={() => dec('nouvelle')} data-decision="remettre">Remettre</button>}
            <button type="button" style={S.bouton} onClick={() => setNote(note == null ? (a.note || '') : null)} data-decision="note">Note</button>
            <button type="button" style={S.bouton} onClick={() => setRenta(!renta)} aria-expanded={renta} data-ouvrir-renta="">Rentabilité</button>
          </div>
        )}
        {refus && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }} data-motifs="">
            {Object.entries(MOTIFS_REFUS).map(([k, lib]) => <button key={k} type="button" style={S.bouton} disabled={occupe} onClick={() => { setRefus(false); dec('refusee', { motif: k }); }} data-motif={k}>{lib}</button>)}
            <button type="button" style={S.bouton} onClick={() => setRefus(false)}>Annuler</button>
          </div>
        )}
        {note != null && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note privée" style={S.champ} data-note-champ=""/>
            <button type="button" style={S.principal} disabled={occupe} onClick={() => { onDecision(a.id, { note }); setNote(null); }}>OK</button>
          </div>
        )}
        {renta && <div style={{ marginTop: 6 }}><Rentabilite C={C} cle={cle} achatInit={a.prix} livraisonInit={a.livraison} ventes={ventes} modeleDe={modeleDe} maintenant={maintenant}/></div>}
      </div>
    </div>
  );
}

// ── LA LISTE DES ANNONCES D'UNE RECHERCHE ────────────────────────────────────
function Annonces({ C, res, maintenant, onDecision, ventes, modeleDe, occupe, lectureSeule }) {
  const S = styles(C);
  const toutes = (res && res.annonces) || [];
  const groupes = [['nouvelle', 'Nouvelles'], ['a-examiner', 'À examiner'], ['achetee', 'Achetées'], ['refusee', 'Refusées']].map(([k, l]) => [k, l, toutes.filter((a) => a.statut === k).length]).filter((g) => g[2] > 0);
  const [vue, setVue] = useState(null);
  const [ordre, setOrdre] = useState('cout');
  const vueEff = groupes.some((g) => g[0] === vue) ? vue : (groupes[0] && groupes[0][0]);
  const liste = useMemo(() => {
    const l = toutes.filter((a) => lectureSeule || a.statut === vueEff);
    const cout = (a) => (a.total == null ? Infinity : a.total + (a.totalConfirme ? 0 : 0.5));
    const date = (a) => Date.parse(a.cree || '') || a.vuLe || 0;
    return l.sort((x, y) => (ordre === 'cout' ? cout(x) - cout(y) : date(y) - date(x)));
  }, [toutes, vueEff, ordre, lectureSeule]);
  if (!toutes.length) return null;
  return (
    <div data-annonces-liste={vueEff || ''} style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {!lectureSeule && groupes.map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setVue(k)} aria-pressed={k === vueEff} data-groupe={k}
            style={k === vueEff ? { ...S.bouton, borderColor: C.accent, color: C.accent } : S.bouton}>{l} · {n}</button>
        ))}
        <label style={{ ...S.muet, marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>Tri
          <select value={ordre} onChange={(e) => setOrdre(e.target.value)} style={{ ...S.champ, width: 'auto', minHeight: 32, fontSize: 13, padding: '4px 8px' }} data-tri="">
            {Object.entries(ORDRES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      {liste.map((a) => <Annonce key={a.id} C={C} a={a} verifAt={res.verif && res.verif.at} maintenant={maintenant} onDecision={onDecision} ventes={ventes} modeleDe={modeleDe} occupe={occupe} lectureSeule={lectureSeule}/>)}
    </div>
  );
}

// La dernière vérification, en une ligne : fraîcheur, ce qui a été lu, ce qui
// a été écarté et pourquoi — et ce qu'eBay a en plus de ce qu'on a regardé.
function LigneVerif({ C, verif, maintenant, libelles }) {
  const S = styles(C);
  if (!verif) return <div style={S.muet} data-fraicheur="jamais">Jamais vérifiée.</div>;
  if (!verif.ok) return <div style={{ ...S.muet, color: C.warn }} data-fraicheur="echec">Dernière vérification ratée {ilYa(verif.at, maintenant)} : {verif.erreur || 'eBay n\'a pas répondu'}.{verif.derniereReussie ? ` Dernière réussie ${ilYa(verif.derniereReussie, maintenant)}.` : ''}</div>;
  const ec = Object.entries(verif.ecartees || {}).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n} ${(libelles && libelles[k]) || k}`);
  return (
    <div style={S.muet} data-fraicheur="ok" data-verif-at={verif.at}>
      Vérifiée {ilYa(verif.at, maintenant)}{verif.source === 'matin' ? ' (passage du matin)' : ''} · {verif.lus} lue{verif.lus > 1 ? 's' : ''} · {verif.retenues} retenue{verif.retenues > 1 ? 's' : ''}
      {ec.length > 0 && <> · écartées : {ec.join(', ')}</>}
      {verif.partiel && <> · une partie de la recherche n'a pas répondu</>}
      {Number.isFinite(verif.totalEbay) && verif.totalEbay > verif.lus && (
        <div data-trop-large="">eBay en a {verif.totalEbay.toLocaleString('fr-FR')} : seules les {verif.lus} plus récentes sont regardées. Précise le modèle, la pointure ou le prix.</div>
      )}
    </div>
  );
}

const resume = (r) => [
  (r.tailles || []).length ? (r.tailles.length > 1 ? 'pointures ' : 'pointure ') + r.tailles.join(', ') : 'toutes pointures',
  (r.etats || []).length ? r.etats.map((e) => (ETATS_VEILLE[e] ? ETATS_VEILLE[e].nom : e)).join(' ou ') : 'tous états',
  `≤ ${eur(r.prixMax)} livraison comprise`,
  r.lots === 'seulement' ? 'lots seulement' : r.lots === 'accepter' ? 'lots acceptés' : 'sans lots',
  r.encheres === 'aussi' ? 'enchères comprises' : 'prix fixe',
  r.pays ? `vendeur en ${r.pays}` : '',
  (r.motsExclus || []).length ? `sans « ${r.motsExclus.join(' », « ')} »` : '',
  (r.noms || []).length > 1 ? `aussi « ${r.noms.slice(1).join(' », « ')} »` : '',
].filter(Boolean).join(' · ');

// ══ L'ÉCRAN ══════════════════════════════════════════════════════════════════
export default function VeilleAchat({ C, headers, confirm, chargerVentes, modeleDe, lireAchatsMois, maintenant: maintenantFixe }) {
  const S = styles(C);
  const [etat, setEtat] = useState('chargement');   // chargement · lu · panne
  const [donnees, setDonnees] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(null);           // null · objet du formulaire
  const [erreurForm, setErreurForm] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [occupe, setOccupe] = useState('');
  const [ventes, setVentes] = useState(undefined);  // undefined lecture · null pas su · tableau
  const [budgetSaisi, setBudgetSaisi] = useState(null);
  const [silence, setSilence] = useState(null);
  const maintenant = maintenantFixe || Date.now();
  const appel = (action, payload) => appelerEbay(action, payload || {}, headers);

  const relire = async () => {
    try { const j = await appel('veillelire'); setDonnees(j); setEtat('lu'); }
    catch (e) { setEtat((x) => (x === 'lu' ? 'lu' : 'panne')); setMessage(e.message || 'Lecture impossible.'); }
  };
  useEffect(() => { relire(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { let vivant = true; (async () => { try { const v = chargerVentes ? await chargerVentes() : null; if (vivant) setVentes(v); } catch (_) { if (vivant) setVentes(null); } })(); return () => { vivant = false; }; /* eslint-disable-next-line */ }, []);

  const recherches = (donnees && donnees.recherches) || [];
  const resultats = (donnees && donnees.resultats) || {};
  const reglages = (donnees && donnees.reglages) || {};
  const ebayDispo = !!(donnees && (donnees.plateformes || []).find((p) => p.id === 'ebay' && p.disponible));
  const quota = donnees && donnees.quota;
  const majResultat = (rid, res) => setDonnees((d) => ({ ...d, resultats: { ...((d && d.resultats) || {}), [rid]: res } }));
  const majQuota = (q) => { if (q) setDonnees((d) => ({ ...d, quota: q })); };

  const enregistrer = async (r) => {
    setOccupe('form'); setErreurForm('');
    try { await appel('veillesauver', { recherche: r }); setForm(null); setSimulation(null); await relire(); }
    catch (e) { setErreurForm(e.message); }
    finally { setOccupe(''); }
  };
  const tester = async (r) => {
    setOccupe('form'); setErreurForm(''); setSimulation(null);
    try { const j = await appel('veilletester', { recherche: r }); setSimulation(j); majQuota(j.quota); }
    catch (e) { setErreurForm(e.message); }
    finally { setOccupe(''); }
  };
  const verifier = async (r) => {
    setOccupe(r.id); setMessage('');
    try {
      const j = await appel('veilleverifier', { id: r.id });
      if (j.resultat) majResultat(r.id, j.resultat);
      majQuota(j.quota);
      setMessage(`${r.nom} : ${j.nouvelles ? `${j.nouvelles} nouvelle${j.nouvelles > 1 ? 's' : ''} annonce${j.nouvelles > 1 ? 's' : ''}` : 'rien de nouveau'}${j.range === false ? ' — résultat non enregistré (la base n\'a pas répondu)' : ''}.`);
    } catch (e) { setMessage(e.message); await relire(); }
    finally { setOccupe(''); }
  };
  const basculer = async (r, champ) => {
    setOccupe(r.id); setMessage('');
    try { await appel('veillesauver', { recherche: { ...r, [champ]: !r[champ] } }); await relire(); }
    catch (e) { setMessage(e.message); }
    finally { setOccupe(''); }
  };
  const supprimer = async (r) => {
    const ok = confirm ? await confirm({ title: 'Supprimer cette recherche ?', desc: `${r.nom}\n\nSes annonces gardées et ses décisions partent avec elle. L'historique reste.`, ok: 'Supprimer', cancel: 'Annuler' }) : true;
    if (!ok) return;
    setOccupe(r.id);
    try { await appel('veillesupprimer', { id: r.id }); await relire(); }
    catch (e) { setMessage(e.message); }
    finally { setOccupe(''); }
  };
  const decider = (rid) => async (itemId, dec) => {
    setOccupe(rid); setMessage('');
    try {
      const j = await appel('veilledecision', { id: rid, itemId, ...dec });
      setDonnees((d) => {
        const res = (d.resultats || {})[rid] || { annonces: [] };
        return { ...d, resultats: { ...d.resultats, [rid]: { ...res, bilan: j.bilan, annonces: res.annonces.map((a) => (a.id === itemId ? { ...a, ...j.annonce } : a)) } } };
      });
      if (j.recherchePausee) { setMessage('Recherche mise en pause : tu as marqué une annonce achetée.'); await relire(); }
    } catch (e) { setMessage(e.message); }
    finally { setOccupe(''); }
  };
  const enregistrerReglages = async (patch) => {
    setOccupe('reglages'); setMessage('');
    try { await appel('veillereglages', { budgetEuros: enEuros(reglages.budget), silence: reglages.silence || null, ...patch }); await relire(); setBudgetSaisi(null); setSilence(null); }
    catch (e) { setMessage(e.message); }
    finally { setOccupe(''); }
  };

  // Les annonces « à examiner » : ce qu'il PRÉVOIT peut-être d'acheter.
  const aExaminer = useMemo(() => Object.values(resultats).flatMap((x) => (x.annonces || []).filter((a) => a.statut === 'a-examiner')), [resultats]);
  const budget = budgetDuMois(reglages.budget == null ? null : reglages.budget, lireAchatsMois ? lireAchatsMois() : null, maintenant);

  return (
    <section data-veille={etat} aria-label="Veille d'achat" style={{ padding: 16, display: 'grid', gap: 14, minWidth: 0 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h2 style={{ ...S.titre, fontSize: 17 }}>Veille d'achat</h2>
          <p style={{ ...S.muet, margin: '3px 0 0' }} data-veille-plateformes="">
            {ebayDispo ? 'Annonces eBay' : 'Recherche eBay non configurée sur le serveur'} · Vinted et Leboncoin non surveillés (aucun accès autorisé) · rien n'est acheté sans toi.
          </p>
        </div>
        {etat === 'lu' && !form && recherches.length < VEILLE_MAX_RECHERCHES && (
          <button type="button" style={S.principal} onClick={() => { setForm({ ...VIDE }); setErreurForm(''); setSimulation(null); }} data-nouvelle="">+ Recherche</button>
        )}
      </header>

      {etat === 'chargement' && <div style={S.muet}>Lecture de ta veille…</div>}
      {etat === 'panne' && (
        <div style={{ ...S.carte, color: C.text, fontSize: 13 }} data-veille-panne="">
          Je n'ai pas pu lire ta veille — rien n'est perdu. {message}{' '}
          <button type="button" style={S.bouton} onClick={() => { setEtat('chargement'); relire(); }}>Réessayer</button>
        </div>
      )}
      {etat === 'lu' && message && <p role="status" style={{ ...S.muet, margin: 0, color: C.text }} data-veille-message="">{message}</p>}

      {form && <Formulaire C={C} initial={form} occupe={occupe === 'form'} erreur={erreurForm} onAnnuler={() => { setForm(null); setSimulation(null); }} onEnregistrer={enregistrer} onTester={tester}/>}
      {simulation && (
        <div style={S.carte} data-veille-simulation="">
          <h3 style={S.titre}>Simulation — rien n'est enregistré, aucune alerte</h3>
          <LigneVerif C={C} verif={simulation.verif} maintenant={maintenant} libelles={donnees && donnees.libellesExclusion}/>
          {(simulation.annonces || []).length === 0
            ? <div style={{ ...S.muet, marginTop: 6 }}>Aucune annonce ne correspond pour l'instant.</div>
            : <Annonces C={C} res={{ annonces: simulation.annonces, verif: simulation.verif }} maintenant={maintenant} ventes={ventes} modeleDe={modeleDe} lectureSeule/>}
          {(simulation.exemples || []).length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ ...S.muet, cursor: 'pointer' }}>Exemples d'annonces écartées</summary>
              <ul style={{ ...S.muet, margin: '6px 0 0', paddingLeft: 18 }} data-ecartees="">
                {simulation.exemples.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{x.titre}</a> — {x.motif}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {etat === 'lu' && !recherches.length && !form && (
        <div style={{ ...S.carte, ...S.muet }} data-veille-vide="">
          Aucune recherche enregistrée. Une recherche = un modèle, tes pointures, un prix maximum livraison comprise. Teste-la avant de l'enregistrer.
        </div>
      )}

      {recherches.map((r) => {
        const res = resultats[r.id] || { annonces: [], bilan: {} };
        const b = res.bilan || {};
        const bilanTxt = [b['a-examiner'] ? `${b['a-examiner']} à examiner` : '', b.achetee ? `${b.achetee} achetée${b.achetee > 1 ? 's' : ''}` : '', b.refusee ? `${b.refusee} refusée${b.refusee > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
        return (
          <article key={r.id} data-recherche={r.id} data-verif={res.verif ? (res.verif.ok ? 'ok' : 'echec') : 'jamais'} data-pause={r.pause ? '1' : '0'} style={S.carte}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: '1 1 260px', display: 'grid', gap: 3 }}>
                <h3 style={S.titre}>{r.nom}{r.pause && <span style={{ ...S.pastille, marginLeft: 6 }} data-en-pause="">en pause</span>}</h3>
                <div style={S.muet}>{resume(r)}</div>
                <LigneVerif C={C} verif={res.verif} maintenant={maintenant} libelles={donnees && donnees.libellesExclusion}/>
                {bilanTxt && <div style={S.muet} data-bilan-recherche="">{bilanTxt}</div>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button type="button" style={S.principal} disabled={!!occupe || !ebayDispo} onClick={() => verifier(r)} data-verifier="">{occupe === r.id ? 'Vérification…' : 'Vérifier'}</button>
                <label style={{ ...S.muet, display: 'flex', gap: 6, alignItems: 'center', color: C.text }} title="Une fois par jour, vers 10 h">
                  <input type="checkbox" checked={!!r.alerte} disabled={!!occupe} onChange={() => basculer(r, 'alerte')} data-alerte=""/> Alerte du matin
                </label>
                <details style={{ position: 'relative' }}>
                  <summary style={{ ...S.bouton, listStyle: 'none', display: 'inline-flex', alignItems: 'center' }} aria-label="Autres actions">⋯</summary>
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 5, display: 'grid', gap: 4, padding: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadow || 'none', minWidth: 150 }}>
                    <button type="button" style={S.bouton} onClick={() => { setForm(versFormulaire(r)); setErreurForm(''); setSimulation(null); }} data-modifier="">Modifier</button>
                    <button type="button" style={S.bouton} disabled={!!occupe} onClick={() => basculer(r, 'pause')} data-pauser="">{r.pause ? 'Reprendre' : 'Mettre en pause'}</button>
                    <button type="button" style={S.bouton} disabled={!!occupe} onClick={() => supprimer(r)} data-supprimer="">Supprimer</button>
                  </div>
                </details>
              </div>
            </div>
            <Annonces C={C} res={res} maintenant={maintenant} onDecision={decider(r.id)} ventes={ventes} modeleDe={modeleDe} occupe={!!occupe}/>
          </article>
        );
      })}

      {etat === 'lu' && (
        <>
          <details style={S.carte} data-veille-budget={budget.etat}>
            <summary style={{ ...S.titre, cursor: 'pointer' }}>
              Budget du mois{budget.etat === 'lu' || budget.etat === 'partiel' ? <span style={{ fontWeight: 600, color: budget.depasse ? C.warn : C.muted, fontSize: 12.5 }}> · {budget.depasse ? `dépassé de ${budget.etat === 'partiel' ? 'au moins ' : ''}${eur(-budget.reste)}` : `${budget.etat === 'partiel' ? 'au plus ' : ''}reste ${eur(budget.reste)}`}</span> : null}
            </summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {budget.etat === 'sans-budget' && <div style={S.muet}>Fixe un budget mensuel pour voir ce qu'il te reste à dépenser.</div>}
              {budget.etat === 'pas-su' && <div style={S.muet} data-budget-pas-su="">Budget {eur(budget.budget)}. Tes achats du mois ne sont pas encore comptés : ouvre une fois Vinted → Achats.</div>}
              {(budget.etat === 'lu' || budget.etat === 'partiel') && (
                <div style={{ fontSize: 13, color: C.text }} data-budget-reste={budget.reste}>
                  Budget {eur(budget.budget)} · dépensé {budget.etat === 'partiel' ? 'au moins ' : ''}{eur(budget.depense)} ({budget.n} achat{budget.n > 1 ? 's' : ''}, Vinted et hors plateforme){budget.etat === 'partiel' && budget.manque.length ? ` — sans ${budget.manque.join(', ')}` : ''}.
                </div>
              )}
              {aExaminer.length > 0 && (() => {
                const connus = aExaminer.filter((a) => a.total != null);
                const somme = connus.reduce((s, a) => s + a.total, 0);
                const sansLivr = aExaminer.filter((a) => !a.totalConfirme).length;
                return <div style={S.muet} data-budget-prevu={somme}>À examiner : {aExaminer.length} annonce{aExaminer.length > 1 ? 's' : ''} · {eur(somme)}{sansLivr ? ` (dont ${sansLivr} sans livraison connue)` : ''}.</div>;
              })()}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ ...S.etiquette, flex: '1 1 160px' }}>Budget mensuel (€)
                  <input inputMode="decimal" value={budgetSaisi != null ? budgetSaisi : enEuros(reglages.budget)} onChange={(e) => setBudgetSaisi(e.target.value)} placeholder="ex. 400" style={S.champ} data-champ="budget"/>
                </label>
                <button type="button" style={S.bouton} disabled={occupe === 'reglages' || budgetSaisi == null} onClick={() => enregistrerReglages({ budgetEuros: budgetSaisi })} data-budget-enregistrer="">Enregistrer</button>
              </div>
            </div>
          </details>

          <details style={S.carte}>
            <summary style={{ ...S.titre, cursor: 'pointer' }}>Rentabilité avant achat</summary>
            <div style={{ marginTop: 10 }}><Rentabilite C={C} ventes={ventes} modeleDe={modeleDe} maintenant={maintenant} attr="libre"/></div>
          </details>

          <details style={S.carte} data-veille-alertes="">
            <summary style={{ ...S.titre, cursor: 'pointer' }}>Alertes</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <div style={S.muet}>Une notification par jour au plus, vers 10 h, pour les recherches où « Alerte du matin » est cochée. Une annonce n'est jamais signalée deux fois.{donnees && donnees.matin && donnees.matin.jour ? ` Dernier passage : ${donnees.matin.jour.split('-').reverse().join('/')}${donnees.matin.etat === 'silence' ? ' (horaire silencieux, rien envoyé)' : donnees.matin.etat === 'coupe' ? ' (notifications de veille coupées dans Réglages)' : ''}.` : ''}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                {['de', 'a'].map((k) => (
                  <label key={k} style={{ ...S.etiquette, width: 110 }}>{k === 'de' ? 'Silence de' : 'à'}
                    <select value={(silence || reglages.silence || {})[k] ?? ''} onChange={(e) => setSilence({ ...(silence || reglages.silence || {}), [k]: e.target.value === '' ? undefined : Number(e.target.value) })} style={S.champ} data-silence={k}>
                      <option value="">—</option>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
                    </select>
                  </label>
                ))}
                <button type="button" style={S.bouton} disabled={occupe === 'reglages' || !silence} onClick={() => enregistrerReglages({ silence: silence && Number.isInteger(silence.de) && Number.isInteger(silence.a) ? silence : null })} data-silence-enregistrer="">Enregistrer</button>
              </div>
            </div>
          </details>

          {((donnees && donnees.historique) || []).length > 0 && (
            <details style={S.carte} data-veille-historique="">
              <summary style={{ ...S.titre, cursor: 'pointer' }}>Historique des décisions</summary>
              <ul style={{ ...S.muet, margin: '8px 0 0', paddingLeft: 18 }}>
                {donnees.historique.slice(0, 30).map((h, i) => (
                  <li key={i}>{new Date(h.at).toLocaleDateString('fr-FR')} · {{ 'a-examiner': 'À examiner', achetee: 'Achetée', refusee: 'Refusée', nouvelle: 'Remise' }[h.a] || (h.note ? 'Note' : h.a)}{h.motif ? ` (${MOTIFS_REFUS[h.motif] || h.motif})` : ''} · {h.titre}</li>
                ))}
              </ul>
            </details>
          )}
          {quota && <div style={S.muet} data-veille-quota={quota.utilise}>Vérifications aujourd'hui : {quota.utilise} sur {quota.max}.</div>}
        </>
      )}
    </section>
  );
}
