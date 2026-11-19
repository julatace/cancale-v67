// ── LA NÉGOCIATION PAR PALIERS — le réglage (19 nov., ext. 5.409) ──────────────────────────
// Dans Messages → Favoris & offres → « Offres auto », sous le message de refus. Éteint par défaut ; l'allumer
// DEMANDE (un programme qui fait des contre-offres sur Vinted). Les paliers (% du chemin vers le plancher), la remise
// maximale quand une paire n'a pas de prix mini, les messages (un tiré au hasard), l'arrondi à l'euro ; l'aperçu
// « 100 → 93 → 88 → 85 · plancher 85 » vient de LA règle (src/negociationPaliers.js, la même que l'extension).
// Écrit dans `vinted_offres_paliers` (synchronisé, l'extension le lit) ; un message risqué n'est jamais rangé.
import React from 'react';
import { tr } from './i18n/index.js';
import { CLE_PALIERS, reglagesPaliers, apercuPaliers, plancherDe } from './negociationPaliers.js';
import { erreurMessageAuto } from './messageSur.js';

export default function NegociationPaliers({ load, save, onCloudReady, askConfirm }) {
  const [r, setR] = React.useState(() => reglagesPaliers(load(CLE_PALIERS, null)));
  React.useEffect(() => (onCloudReady ? onCloudReady(() => setR(reglagesPaliers(load(CLE_PALIERS, null)))) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [pcts, setPcts] = React.useState(() => r.paliers.join(', '));
  const [msgs, setMsgs] = React.useState(() => r.messages.join('\n'));
  const ecrire = (n) => { const v = reglagesPaliers(n); setR(v); save(CLE_PALIERS, { ...v, messages: v.messages.filter((t) => !erreurMessageAuto(t)) }); };
  const basculer = async () => {
    if (r.actif) { ecrire({ ...r, actif: false }); return; }
    const ok = askConfirm ? await askConfirm({ title: tr('np.confirmer.titre'), desc: tr('np.confirmer.desc'), ok: tr('np.confirmer.ok'), cancel: tr('np.confirmer.annuler') }) : true;
    if (ok) ecrire({ ...r, actif: true });
  };
  const exemple = 100;
  const f = plancherDe(exemple, r.remiseMax ? null : 85, r.remiseMax);
  const ap = f != null ? apercuPaliers(exemple, f, r) : null;
  const risque = msgs.split('\n').map((t) => t.trim()).filter(Boolean).find((t) => erreurMessageAuto(t));
  return (
    <div className="vrm-oa-groupe" data-paliers={r.actif ? 'on' : 'off'}>
      <h3 className="vrm-oa-titre">{tr('np.titre')}</h3>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <input type="checkbox" role="switch" checked={r.actif} onChange={basculer} data-paliers-actif=""/>
        <span>{tr(r.actif ? 'np.actif' : 'np.eteint')}</span>
      </label>
      <p style={{ margin: '4px 0 8px', fontSize: 14 }}>{tr('np.regle')}</p>
      <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        <span>{tr('np.paliers')}</span>
        <input type="text" inputMode="numeric" value={pcts} data-paliers-pcts="" onChange={(e) => setPcts(e.target.value)} onBlur={() => ecrire({ ...r, paliers: pcts.split(/[^\d]+/).filter(Boolean).map(Number) })} style={{ minHeight: 44 }}/>
      </label>
      <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        <span>{tr('np.remise')}</span>
        <input type="text" inputMode="numeric" value={r.remiseMax == null ? '' : String(r.remiseMax)} data-paliers-remise="" onChange={(e) => ecrire({ ...r, remiseMax: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} style={{ minHeight: 44 }}/>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <input type="checkbox" checked={r.arrondi} onChange={() => ecrire({ ...r, arrondi: !r.arrondi })} data-paliers-arrondi=""/>
        <span>{tr('np.arrondi')}</span>
      </label>
      <label style={{ display: 'grid', gap: 4, margin: '8px 0' }}>
        <span>{tr('np.messages')}</span>
        <textarea rows={3} value={msgs} data-paliers-messages="" onChange={(e) => setMsgs(e.target.value)} onBlur={() => ecrire({ ...r, messages: msgs.split('\n') })}/>
      </label>
      {risque ? <p role="status" data-message-auto-refuse="" style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>{erreurMessageAuto(risque)}</p> : null}
      <p data-paliers-apercu={ap ? ap.chaine.join('>') : ''} style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {ap ? tr('np.apercu', { chaine: ap.chaine.join(' → '), plancher: String(ap.plancher) }) : tr('np.apercu.rien')}
      </p>
    </div>
  );
}
