// ── REMISE EN MAIN PROPRE ORGANISÉE (11 nov., lot lbc-plus) ──────────────────
// Sur une vente Leboncoin (il est le VENDEUR, ni annulée, ni partie par colis, ni
// finalisée sans lui) : « Organiser la remise » ⇒ date, heure, lieu (SON geste,
// rien n'est proposé ni créé sans « Enregistrer ») ; une heure avant, une
// notification (le passage de 15 min du serveur, api/_lib/remises-main-propre.js) ;
// puis « Remis » en UN toucher (annulable 5 s, la pilule commune) :
//   · la remise est notée faite ;
//   · la vente est datée pour la compta (`vrm_lbc_dates[tx]`, si aucune date n'est
//     LUE ni déjà saisie : une date lue par l'extension gagne toujours) ;
//   · la paire sort du stock PAR IDENTITÉ : le N° de la vente (`numeroLbcIdentite`)
//     désigne UNE fiche ⇒ « vendue en main propre » (`vrm_cycle_decisions` +
//     `vinted_annonces_vendues`, les écritures de Ma journée), N° gardé (jamais
//     réattribué) ; N° absent ou porté par plusieurs fiches ⇒ rien n'est deviné, c'est dit.
import React from 'react';
import { tr, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireRemises, remiseSaisie, remiseDeVente, remiseFaiteDeVente, poserRemise, marquerRemise, annulerRemise, purgerRemises, finRemises,
  instantRemise, jourParisRemise, CLE_REMISES, CLE_REMISE_FIN, LIEU_MAX } from '../api/_lib/remises-main-propre.js';
import { opsRemis } from './lbcPlus.js';
import { motsVendeur } from './profilVendeur.js';
// (intégration 11nov-g2) les phrases qui nomment l'article : « paire » pour Sneakers, sinon la variante `.art`.
const tv = (k, p) => tr(motsVendeur().nom === 'paire' ? k : k + '.art', p);
import { C, askConfirm, cleNum, gesteVrm, load, save, toast } from './App.jsx';

const EVT = 'vrm:remises';
const lireCarte = () => { const v = load(CLE_REMISES, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
const ecrireCarte = (carte) => {
  const c = purgerRemises(carte);
  save(CLE_REMISES, c);
  save(CLE_REMISE_FIN, finRemises(c));
  try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
};
function useRemises() {
  const [carte, setCarte] = React.useState(lireCarte);
  React.useEffect(() => {
    const maj = () => setCarte(lireCarte());
    // `save` écrit l'appareil 500 ms plus tard : on relit à SON signal (`vrm:save`), pas avant.
    const sauve = (e) => { if (e && e.detail && (e.detail.k === CLE_REMISES || e.detail.k === 'vrm_lbc_dates')) maj(); };
    window.addEventListener(EVT, maj);
    window.addEventListener('vrm:save', sauve);
    window.addEventListener('storage', maj);
    return () => { window.removeEventListener(EVT, maj); window.removeEventListener('vrm:save', sauve); window.removeEventListener('storage', maj); };
  }, []);
  return carte;
}
// Les derniers lieux qu'IL a tapés (au plus 3) : un toucher les recopie.
const derniersLieux = (remises) => [...new Set(remises.slice().sort((a, b) => (a.majAt < b.majAt ? 1 : -1)).map((r) => r.lieu).filter(Boolean))].slice(0, 3);
const quandTexte = (r) => {
  const t = instantRemise(r.jour, r.heure);
  if (!Number.isFinite(t)) return '';
  return `${dateLoc(new Date(t), { weekday: 'short', day: 'numeric', month: 'short' })} · ${r.heure.replace(':', ' h ')}`;
};
const champ = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 17, fontFamily: 'inherit' };
const btn = (plein) => ({ minHeight: 44, padding: '0 14px', borderRadius: 12, border: plein ? 'none' : `1px solid ${C.border}`, background: plein ? C.accent : 'transparent', color: plein ? (C.onAccent || '#fff') : C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' });

function FeuilleRemise({ o, num, avant, lieux, onFermer }) {
  useLangue();
  const auj = jourParisRemise();
  const [jour, setJour] = React.useState(avant ? avant.jour : auj);
  const [heure, setHeure] = React.useState(avant ? avant.heure : '');
  const [lieu, setLieu] = React.useState(avant ? avant.lieu : '');
  const [err, setErr] = React.useState('');
  const enregistrer = () => {
    const s = remiseSaisie({ tx: o.txId, num, jour, heure, lieu }, Date.now(), undefined, avant);
    if (!s.ok) { setErr(tr('lbcplus.remise.erreur.' + s.erreur)); return; }
    ecrireCarte(poserRemise(lireCarte(), s.remise));
    toast(tr('lbcplus.remise.notee'), 'ok');
    onFermer();
  };
  return (
    <div data-remise-feuille={String(o.txId)} style={{ flex: '1 1 100%', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '12px 14px', marginTop: 6 }}>
      <div>
        <div className="vrm-display" style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('lbcplus.remise.titre')}</div>
        <div style={{ fontSize: 13, color: C.muted, margin: '4px 0 12px', lineHeight: 1.45 }}>{num ? `N°${num} · ` : ''}{String(o.title || '').slice(0, 60)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: '1 1 0', fontSize: 12, color: C.muted }}>{tr('lbcplus.remise.jour')}
            <input type="date" data-remise-jour="" value={jour} min={auj} onChange={(e) => { setJour(e.target.value); setErr(''); }} style={{ ...champ, marginTop: 4 }}/></label>
          <label style={{ flex: '1 1 0', fontSize: 12, color: C.muted }}>{tr('lbcplus.remise.heure')}
            <input type="time" data-remise-heure="" value={heure} step={300} onChange={(e) => { setHeure(e.target.value); setErr(''); }} style={{ ...champ, marginTop: 4 }}/></label>
        </div>
        <label style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 10 }}>{tr('lbcplus.remise.lieu')}
          <input type="text" data-remise-lieu="" value={lieu} maxLength={LIEU_MAX} placeholder={tr('lbcplus.remise.lieuExemple')} onChange={(e) => { setLieu(e.target.value); setErr(''); }} style={{ ...champ, marginTop: 4 }}/></label>
        {lieux.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{lieux.map((l) => <button key={l} type="button" data-remise-lieu-rapide="" onClick={() => setLieu(l)} style={{ ...btn(false), minHeight: 36, fontWeight: 500 }}>{l}</button>)}</div> : null}
        <p style={{ fontSize: 12, color: C.muted, margin: '10px 0 0', lineHeight: 1.45 }}>{tr('lbcplus.remise.rappel')}</p>
        {err ? <p role="alert" data-remise-erreur="" style={{ fontSize: 13, color: C.warn, margin: '8px 0 0' }}>{err}</p> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFermer} style={btn(false)}>{tr('lbcplus.annuler')}</button>
          <button type="button" data-remise-enregistrer="" onClick={enregistrer} style={btn(true)}>{tr('lbcplus.remise.enregistrer')}</button>
        </div>
      </div>
    </div>
  );
}

export default function RemiseMainPropre({ o, num = '', eligible = true }) {
  useLangue();
  const carte = useRemises();
  const [feuille, setFeuille] = React.useState(false);
  if (!o || o.isSeller !== true || !o.txId) return null;
  const remises = lireRemises(carte);
  const prevue = remiseDeVente(remises, o.txId);
  const faite = remiseFaiteDeVente(remises, o.txId);
  if (faite && !prevue) return <div data-remise-faite={String(o.txId)} style={{ fontSize: 12, color: C.muted, padding: '4px 0' }}>{tr('lbcplus.remise.faite', { quand: dateLoc(new Date(faite.remiseAt || faite.majAt), { day: 'numeric', month: 'short' }) })}</div>;
  if (!prevue && !eligible) return null;
  const remis = async () => {
    const ok = await askConfirm({ title: tr('lbcplus.remise.remisTitre', { num: num ? 'N°' + num : tv('lbcplus.remise.laPaire') }), desc: tv('lbcplus.remise.remisDesc'), ok: tr('lbcplus.remise.remis'), cancel: tr('lbcplus.annuler') });
    if (!ok) return;
    const c0 = lireCarte();
    const r = opsRemis({ carte: c0, remise: prevue, vente: o, num, fiches: load('vinted_annonce_numeros', {}) || {}, dates: load('vrm_lbc_dates', {}) || {},
      decisions: load('vrm_cycle_decisions', {}) || {}, vendus: load('vinted_annonces_vendues', []) || [], cle: cleNum });
    if (!r) return;
    const texte = r.stock === 'sortie' ? tr('lbcplus.remise.faiteStock', { num }) : tr('lbcplus.remise.faiteSansStock');
    gesteVrm(texte, r.ops, {}, (sens) => {
      save(CLE_REMISE_FIN, finRemises(sens === 'avant' ? c0 : r.carteApres));
      try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
    });
    if (r.stock === 'plusieurs' || r.stock === 'aucune-fiche') toast(tv('lbcplus.remise.stockPasSur'), 'info');
  };
  const annuler = async () => {
    const ok = await askConfirm({ title: tr('lbcplus.remise.annulerTitre'), desc: tr('lbcplus.remise.annulerDesc'), ok: tr('lbcplus.remise.annulerOk'), cancel: tr('lbcplus.garder') });
    if (!ok) return;
    const c = annulerRemise(lireCarte(), prevue.id);
    if (c) ecrireCarte(c);
  };
  return (
    <div data-remise-vente={String(o.txId)} data-remise-etat={prevue ? 'prevue' : 'aucune'} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
      {prevue ? <>
        <span style={{ flex: '1 1 180px', minWidth: 0, fontSize: 13, color: C.text }} data-remise-quand={`${prevue.jour}T${prevue.heure}`}>
          <b>{tr('lbcplus.remise.prevue')}</b> · {quandTexte(prevue)}{prevue.lieu ? ` · ${prevue.lieu}` : ''}
        </span>
        <button type="button" data-remise-remis="" onClick={remis} style={btn(true)}>{tr('lbcplus.remise.remis')}</button>
        <button type="button" data-remise-modifier="" onClick={() => setFeuille(true)} style={btn(false)}>{tr('lbcplus.modifier')}</button>
        <button type="button" data-remise-annuler="" onClick={annuler} style={btn(false)}>{tr('lbcplus.annuler')}</button>
      </> : <button type="button" data-remise-organiser="" onClick={() => setFeuille(true)} style={btn(false)}>{tr('lbcplus.remise.organiser')}</button>}
      {feuille ? <FeuilleRemise o={o} num={num} avant={prevue} lieux={derniersLieux(remises)} onFermer={() => setFeuille(false)}/> : null}
    </div>
  );
}
