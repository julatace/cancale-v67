// ─────────────────────────────────────────────────────────────────────────────
// « ACHATS LUS DANS TES E-MAILS » (11 nov., lot achats-auto)
// Leboncoin, eBay, Vestiaire : ce que le serveur a lu dans les e-mails de
// confirmation (src/achatsAuto.js, api/_lib/achats-email.js). Rien n'entre dans
// « dépensé » sans SON clic : « Ajouter à mes achats » (prix lu marqué « lu dans
// l'e-mail », corrigeable ensuite comme tout achat) ou « Compléter » un achat qu'il
// a saisi avec le même n° de commande. Les e-mails « à vérifier » sont dits, avec
// leur raison : aucun achat n'en sort.
// Rien lu (base injoignable) ⇒ la carte le dit (« — »), jamais « aucun achat ».
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { tr, monnaie } from './i18n/index.js';
import { LogoSite } from './SelecteurSites.jsx';
import { lignesAchatsEmail, fusionAchatsAuto, entreeDepuisEmail, nomSiteAchat, SELECT_ACHATS_EMAIL } from './achatsAuto.js';

export default function AchatsParEmail({ lireTout, offBuys = [], onAjouter, onModifier, C }) {
  const [lu, setLu] = useState(undefined);              // undefined en cours · null pas su · { achats, aVerifier }
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let vivant = true;
    (async () => {
      let rows = null;
      try { rows = await lireTout(`id=like.achat_email_*&select=${SELECT_ACHATS_EMAIL}`); } catch (_) { rows = null; }
      if (vivant) setLu(lignesAchatsEmail(rows));
    })();
    return () => { vivant = false; };
  }, [lireTout]);
  if (lu === undefined) return null;
  const carte = { marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '12px 14px' };
  if (lu === null) return <div data-achats-email="pas-su" style={{ ...carte, fontSize: 13, color: C.muted }}>{tr('achatsEmail.titre')} · — {tr('achatsEmail.pasSu')}</div>;
  if (!lu.achats.length && !lu.aVerifier.length) return null;      // rien reçu : rien à dire (aucun e-mail d'achat encore)
  const lignes = fusionAchatsAuto(offBuys, lu.achats);
  const nouveaux = lignes.filter((l) => l.etat === 'nouveau').length;
  const bouton = { minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
  return (
    <section data-achats-email="lu" data-nouveaux={nouveaux} data-a-verifier={lu.aVerifier.length} style={carte}>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text, flex: 1 }}>{tr('achatsEmail.titre')}</span>
        <span style={{ fontSize: 13, color: nouveaux || lu.aVerifier.length ? C.warn : C.muted }}>
          {tr('achatsEmail.resume', { n: lignes.length, v: lu.aVerifier.length })}
        </span>
      </button>
      {ouvert && (<>
        <div style={{ fontSize: 12, color: C.muted, margin: '2px 0 8px' }}>{tr('achatsEmail.explication')}</div>
        {lignes.map(({ a, manuel, etat, patch }) => (
          <div key={a.id} data-achat-email={a.id} data-etat={etat} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
            {a.photo ? <img src={a.photo} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flex: 'none' }}/> : <div style={{ width: 48, height: 48, borderRadius: 8, background: C.border, flex: 'none' }}/>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><LogoSite site={a.site}/> {a.titre || nomSiteAchat(a.site)}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {a.prix.total != null ? <span data-prix-lu="">{monnaie(a.prix.total)} · {tr('achatsEmail.luDansEmail')}</span> : '—'}
                {' · '}{tr('achatsEmail.commande', { n: a.commande })}
                {a.suivi ? ' · ' + tr('achatsEmail.suivi', { n: a.suivi }) : ''}
              </div>
              {etat === 'annule' && <div style={{ fontSize: 12, color: C.muted }}>{a.rembourse ? tr('achatsEmail.rembourse') : tr('achatsEmail.annule')}</div>}
              {etat === 'relie' && <div style={{ fontSize: 12, color: C.muted }}>{tr('achatsEmail.dejaDansTesAchats')}</div>}
            </div>
            {etat === 'nouveau' && <button type="button" data-ajouter="" style={bouton} onClick={() => onAjouter({ id: 'ob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...entreeDepuisEmail(a) })}>{tr('achatsEmail.ajouter')}</button>}
            {etat === 'relie' && patch && <button type="button" data-completer="" style={bouton} onClick={() => onModifier(manuel.id, patch)}>{tr('achatsEmail.completer')}</button>}
          </div>
        ))}
        {lu.aVerifier.length > 0 && (<>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, margin: '12px 0 4px' }}>{tr('achatsEmail.aVerifier', { n: lu.aVerifier.length })}</div>
          {lu.aVerifier.map((v) => (
            <div key={v.id} data-a-verifier-ligne={v.id} style={{ padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>
              <LogoSite site={v.site}/> {v.lecture.titre || nomSiteAchat(v.site)}
              <div style={{ fontSize: 12, color: C.muted }}>{v.raison}</div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{tr('achatsEmail.aVerifierGeste')}</div>
        </>)}
      </>)}
    </section>
  );
}
