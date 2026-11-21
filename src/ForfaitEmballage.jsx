// ── src/ForfaitEmballage.jsx — le FORFAIT D'EMBALLAGE qu'il règle (21 nov., lot rentabilite, choix n° 41) ─────────────────
// Éteint par défaut. Allumé, `coutsVente` (src/beneficePaire.js) le compte pour chaque vente dont l'emballage n'est pas
// saisi — dans le coût réel de la vente et dans tous les bénéfices. Rien n'est posé sans SON toucher (« Activer »), un
// montant illisible n'est jamais enregistré, « Éteindre » le retire de partout (rien d'autre n'est modifié).
// La donnée : `vrm_forfait_emballage` = { actif, montant, at } (synchronisée), écrite par `ecrire` (le `save` de l'app).
import React from 'react';
import { tr } from './i18n/index.js';
import { centimes, forfaitDe } from './beneficePaire.js';

const euros = (c) => (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €';
// `forme` : 'dl' (une ligne d'une liste <dl>, la fiche de vente d'avant) · 'ba' (une ligne du détail du bénéfice de la fiche).
export default function ForfaitEmballage({ lire, ecrire, forme = 'dl' }) {
  const Dt = forme === 'ba' ? 'span' : 'dt', Dd = forme === 'ba' ? 'span' : 'dd';
  const classe = forme === 'ba' ? 'vrm-ba-ligne vrm-cr-forfait' : 'vrm-recap-ligne vrm-cr-forfait';
  const [r, setR] = React.useState(() => { try { return lire() || null; } catch (_) { return null; } });
  const [edit, setEdit] = React.useState(false);
  const [txt, setTxt] = React.useState(() => (r && r.montant ? String(r.montant).replace('.', ',') : ''));
  const [err, setErr] = React.useState(false);
  const c = forfaitDe(r);
  const poser = (x) => { setR(x); try { ecrire(x); } catch (_) {} };
  if (!edit) {
    return (
      <div className={classe} data-cr-forfait={c != null ? String(c) : ''}>
        <Dt><span className="vrm-cr-lib">{tr('cr.forfait')}<small>{c != null ? tr('cr.forfait.sous') : tr('cr.forfait.eteint')}</small></span></Dt>
        <Dd><button type="button" className="vrm-cr-lien" data-cr-forfait-ouvrir="" onClick={() => setEdit(true)}>{c != null ? euros(c) : tr('cr.forfait.regler')}</button></Dd>
      </div>
    );
  }
  const activer = () => {
    const t = txt.trim().replace(/\s*€$/, '').replace(',', '.');
    const v = centimes(t);
    if (v == null || v <= 0) { setErr(true); return; }
    setErr(false); poser({ actif: true, montant: t, at: Date.now() }); setEdit(false);
  };
  return (
    <div className={classe} data-cr-forfait-edition="">
      <Dt><span className="vrm-cr-lib">{tr('cr.forfait')}<small>{tr('cr.forfait.aide')}</small></span></Dt>
      <Dd className="vrm-cv-champ">
        <input inputMode="decimal" aria-label={tr('cr.forfait.montant')} aria-invalid={err ? 'true' : undefined} value={txt} placeholder="0,80"
          onChange={(ev) => { setTxt(ev.target.value); setErr(false); }} onKeyDown={(ev) => { if (ev.key === 'Enter') activer(); }} data-cr-forfait-champ=""/>
        <button type="button" className="vrm-cv-ok" onClick={activer} data-cr-forfait-activer="">{tr('cr.forfait.activer')}</button>
        {c != null ? <button type="button" className="vrm-cr-lien" onClick={() => { poser({ actif: false, montant: r && r.montant ? r.montant : '', at: Date.now() }); setEdit(false); }} data-cr-forfait-eteindre="">{tr('cr.forfait.eteindre')}</button> : null}
      </Dd>
    </div>
  );
}

// ── UNE LIGNE DU COÛT RÉEL (commission, boost, port, autres) : le montant, ou « — » et la raison ; jamais un 0 deviné. ──
// `l` : une ligne de `coutReelVente` (src/coutReel.js) { cle, c (centimes | null), src } ; `site` : la règle du site dite.
// Ce qui ne compte pas et ne se lit pas (un boost jamais noté) se dit en gris ; aucune ligne n'est un geste obligatoire.
const SOUS = { lu: 'cr.src.lu', saisi: 'cr.src.saisi', forfait: 'cr.src.forfait', pasLu: 'cr.src.pasLu', illisible: 'cr.src.illisible', ebay: 'cr.src.ebay' };
export function LigneCoutReel({ l, site = 'Vinted', Point = null }) {
  if (!l || l.cle === 'vente' || l.cle === 'achat') return null;
  const sous = l.src === 'regle' ? tr(site === 'Leboncoin' ? 'cr.src.regleLbc' : 'cr.src.regleVinted')
    : l.src === 'aucun' ? tr(l.cle === 'port' ? 'cr.src.portAucun' : 'cr.src.aucun') : (SOUS[l.src] ? tr(SOUS[l.src]) : '');
  const v = l.c == null ? '—' : l.c === 0 ? euros(0) : '−' + euros(l.c);
  return (
    <div className="vrm-recap-ligne" data-cr-ligne={l.cle} data-cr-src={l.src} data-cr-c={l.c == null ? '' : String(l.c)}>
      <dt>{Point ? <Point cle="frais"/> : null}<span className="vrm-cr-lib">{tr('cr.' + l.cle)}{sous ? <small>{sous}</small> : null}</span></dt>
      <dd>{v}</dd>
    </div>
  );
}
