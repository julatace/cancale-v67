// ── src/NavigateursExtension.jsx — « Navigateurs avec l'extension VRM » (23 nov., lot appareils-connectes) ──
// Dans Paramètres → Sécurité → « Appareils connectés », sous les sessions : les navigateurs où l'extension VRM tourne
// pour CE compte (lignes `ext_appareil_*`, règle pure src/appareilsExtension.js). Lue en projection scalaire avec
// `owner=eq.<lui>` par `lireTout` (pagination) ; `undefined` en cours · `null` pas su (« Réessayer ») · liste.
// Aucun geste ici : « Se déconnecter partout » ferme aussi l'extension (c'est dit). Aucun import d'App.jsx (props).
import React from 'react';
import { tr } from './i18n/index.js';
import { Bouton, Glyphe, Groupe, Rangee, Pastille } from './natif/index.js';   // le design natif : groupe, rangées, bouton commun
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
    <Groupe titre={tr('parametres.appExt.titre')} attrs={{ 'data-ext-navigateurs': L === undefined ? 'lecture' : L === null ? 'pas-su' : String(L.length) }}
      pied={tr('parametres.appExt.sous')}>
      {L === undefined ? <Rangee titre={tr('v2.jour.lecture')}/>
        : L === null ? <>
            <Rangee titre={tr('parametres.appExt.passu')} attrs={{ 'data-ext-navigateurs-erreur': '' }}/>
            <div style={{ padding: '4px 16px 12px' }}><Bouton variante="teinte" icone={<Glyphe nom="sync"/>} onClick={lire} attrs={{ 'data-ext-reessayer': '' }}>{tr('parametres.appExt.reessayer')}</Bouton></div>
          </>
        : !L.length ? <Rangee titre={tr('parametres.appExt.aucun')}/>
        : L.map((a) => (
          <Rangee key={a.id} titre={a.nom || tr('parametres.appExt.sansNom')}
            sousTitre={[a.ver ? tr('parametres.appExt.version', { v: a.ver }) : '', a.atMs != null ? tr('parametres.appExt.vue', { quand: quand(a.atMs) }) : tr('parametres.appExt.jamais')].filter(Boolean).join(' · ')}
            pastille={a.active ? <Pastille ton="neutre">{tr('parametres.appExt.active')}</Pastille> : null}
            attrs={{ 'data-ext-navigateur': a.id, 'data-ext-active': a.active == null ? '' : a.active ? '1' : '0' }}/>
        ))}
      <details className="vrm-repli" data-ext-pourquoi="" style={{ padding: '8px 16px 12px' }}><summary>{tr('parametres.appExt.pourquoi')}</summary><span style={{ display: 'block', marginTop: 6 }}>{tr('parametres.appExt.pourquoi.texte')}</span></details>
    </Groupe>
  );
}
