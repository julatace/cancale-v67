// ══════════════════════════════════════════════════════════════════════════════
//  LE CALENDRIER FISCAL DE L'ANNÉE (16 nov., confiance-clients, point 8) — Argent → Micro-entreprise
//  La règle : src/calendrierFiscal.js (rien de calculé ici). Une ligne par échéance : la date, ce qu'il
//  faut faire, « Fait » quand SON registre le dit (URSSAF), la source des dates officielles.
//  « Pas su » / « pas choisi » se disent, jamais devinés. Couleur RARE (§7) : ambre seulement pour la
//  prochaine échéance à faire dans les 7 jours.
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { calendrierFiscal } from '../calendrierFiscal.js';

const jourCourt = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

export default function CalendrierFiscalCarte({ regime, freq, declare, ligne, activite, debut = null, now = new Date(), Carte = 'div', style = {}, titreStyle = {} }) {
  const annee = now.getFullYear();
  const cal = React.useMemo(() => calendrierFiscal({ regime, freq, declare, ligne, activite: activite || 'vente', debut, annee, now }), [regime, freq, declare, ligne, activite, debut, annee]); // eslint-disable-line react-hooks/exhaustive-deps
  const auj = `${annee}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const prochaine = cal.echeances.find((e) => !e.fait && !e.exoneree && (e.fin || e.jour) >= auj);
  const dans7 = (e) => { const [y, m, d] = e.jour.split('-').map(Number); return (new Date(y, m - 1, d, 12) - now) / 864e5 <= 7; };
  return (
    <Carte style={style}>
      <div data-calendrier-fiscal={cal.etat} data-cf-annee={annee}>
        <div style={titreStyle}>{tr('cf.titre', { annee })}</div>
        {cal.etat === 'encours' ? <p style={{ fontSize: 13, color: 'var(--vrm-muted)', margin: '6px 0 0' }}>…</p> : null}
        {cal.etat === 'aChoisir' ? <p data-cf-manque="regime" style={{ fontSize: 13, color: 'var(--vrm-muted)', margin: '6px 0 0' }}>{tr('cf.regime')}</p> : null}
        {cal.etat === 'horsMicro' ? <p data-cf-manque="hors-micro" style={{ fontSize: 13, color: 'var(--vrm-muted)', margin: '6px 0 0' }}>{tr('cf.horsMicro')}</p> : null}
        {cal.etat === 'ok' ? <>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 8 }}>
            {cal.echeances.map((e) => (
              <li key={e.id} data-cf-echeance={e.type} data-cf-jour={e.jour} data-cf-fait={e.fait ? '1' : '0'} style={{ display: 'flex', gap: 12, alignItems: 'baseline', opacity: e.fait || e.exoneree ? 0.75 : 1 }}>
                <b style={{ flex: '0 0 76px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: prochaine === e && dans7(e) ? 'var(--vrm-warn)' : 'var(--vrm-ink)' }}>{e.fin ? `${jourCourt(e.jour)} – ${jourCourt(e.fin)}` : jourCourt(e.jour)}</b>
                <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--vrm-ink)', minWidth: 0 }}>
                  {e.type === 'urssaf' ? tr('cf.urssaf', { periode: e.titre.split(' · ').slice(1).join(' · ') }) : e.type === 'cfe' ? (e.exoneree ? tr('cf.cfeExoneree') : tr('cf.cfe')) : e.type === 'impot' ? tr('cf.impot', { annee: annee - 1 }) : tr('cf.tva')}
                  {e.fait ? <span style={{ color: 'var(--vrm-muted)' }}> · {tr('cf.fait')}</span> : null}
                  {e.type === 'impot' ? <small style={{ display: 'block', color: 'var(--vrm-muted)', fontSize: 12 }}>{tr('cf.zones', { z1: jourCourt(e.zones[0].limite), z2: jourCourt(e.zones[1].limite), z3: jourCourt(e.zones[2].limite) })} · {e.source}</small> : null}
                  {e.type === 'tva' ? <small style={{ display: 'block', color: 'var(--vrm-muted)', fontSize: 12 }}>{tr('cf.tvaNote')}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          {cal.manque.includes('rythme') ? <p data-cf-manque="rythme" style={{ fontSize: 13, color: 'var(--vrm-muted)', margin: '8px 0 0' }}>{tr('cf.rythme')}</p> : null}
          {cal.manque.includes('dates-impot') ? <p data-cf-manque="dates-impot" style={{ fontSize: 13, color: 'var(--vrm-muted)', margin: '8px 0 0' }}>{tr('cf.datesImpot')}</p> : null}
          <p style={{ fontSize: 12, color: 'var(--vrm-muted)', margin: '10px 0 0' }}>{tr('cf.veille')}</p>
        </> : null}
      </div>
    </Carte>
  );
}
