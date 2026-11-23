// ── src/NavigateursExtension.jsx — « Navigateurs avec l'extension VRM » (23 nov., lot appareils-connectes) ──
// Dans Paramètres → Sécurité → « Appareils connectés », sous les sessions : les navigateurs où l'extension VRM tourne
// pour CE compte (lignes `ext_appareil_*`, règle pure src/appareilsExtension.js). Lue en projection scalaire avec
// `owner=eq.<lui>` par `lireTout` (pagination) ; `undefined` en cours · `null` pas su (« Réessayer ») · liste.
// Aucun geste ici : « Se déconnecter partout » ferme aussi l'extension (c'est dit). Aucun import d'App.jsx (props).
import React from 'react';
import { tr } from './i18n/index.js';
import { requeteNavigateurs, navigateursExtension } from './appareilsExtension.js';

export default function NavigateursExtension({ owner = '', lireTout, quand = (t) => new Date(t).toLocaleString() }) {
  const [rows, setRows] = React.useState(undefined);   // undefined en cours · null pas su · lignes
  const lire = React.useCallback(() => {
    const q = requeteNavigateurs(owner);
    if (!q) { setRows(null); return; }
    setRows(undefined);
    lireTout(q).then((r) => setRows(Array.isArray(r) ? r : null), () => setRows(null));
  }, [owner, lireTout]);
  React.useEffect(() => { lire(); }, [lire]);
  const L = rows === undefined ? undefined : navigateursExtension(rows);
  return (
    <div className="vrm-sec-liste" data-ext-navigateurs={L === undefined ? 'lecture' : L === null ? 'pas-su' : String(L.length)} style={{ marginTop: 12 }}>
      <div className="vrm-sec-ligne"><div className="vrm-sec-corps">
        <span className="vrm-sec-titre">{tr('parametres.appExt.titre')}</span>
        <span className="vrm-sec-sous" style={{ whiteSpace: 'normal' }}>{tr('parametres.appExt.sous')}</span>
      </div></div>
      {L === undefined ? <div className="vrm-sec-vide">…</div>
        : L === null ? <div className="vrm-sec-ligne" data-ext-navigateurs-erreur=""><div className="vrm-sec-corps"><span className="vrm-sec-sous" style={{ whiteSpace: 'normal' }}>{tr('parametres.appExt.passu')}</span></div>
            <button type="button" className="vrm-sec-bouton" onClick={lire}>{tr('parametres.appExt.reessayer')}</button></div>
        : !L.length ? <div className="vrm-sec-ligne"><div className="vrm-sec-corps"><span className="vrm-sec-sous">{tr('parametres.appExt.aucun')}</span></div></div>
        : L.map((a) => (
          <div key={a.id} className="vrm-sec-ligne" data-ext-navigateur={a.id} data-ext-active={a.active == null ? '' : a.active ? '1' : '0'}>
            <div className="vrm-sec-corps">
              <span className="vrm-sec-titre">{a.nom || tr('parametres.appExt.sansNom')}</span>
              <span className="vrm-sec-sous">{[a.ver ? tr('parametres.appExt.version', { v: a.ver }) : '', a.atMs != null ? tr('parametres.appExt.vue', { quand: quand(a.atMs) }) : tr('parametres.appExt.jamais')].filter(Boolean).join(' · ')}</span>
            </div>
            {a.active ? <span className="vrm-sec-etat is-ici">{tr('parametres.appExt.active')}</span> : null}
          </div>
        ))}
    </div>
  );
}
