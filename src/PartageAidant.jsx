// ── PARAMÈTRES → STOCK ET RANGEMENT → « Partager le stock avec un aidant » (16 nov., lot partage-aidant) ──
// La liste des liens ACTIFS (expiration, copier, révoquer), « Créer un lien » (24 h par défaut, ou 7 jours) et
// « Mettre à jour le stock ». Le stock publié vient de `vue()` (src/aidantStock.js, refiltré côté serveur :
// api/_lib/aidant-lien.js). `appel(methode, corps)` → la réponse JSON de /api/compte?mode=aidant (SA session) ou null.
import React from 'react';
import { tr, date as dateLoc } from './i18n/index.js';
import { useLangue } from './i18n/react.js';

export function PartageAidant({ appel, vue, Bouton, Segmente }) {
  useLangue();
  const [E, setE] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const [heures, setHeures] = React.useState(24);
  const [copie, setCopie] = React.useState('');
  const [erreur, setErreur] = React.useState(false);
  React.useEffect(() => { let mort = false; appel('GET').then((r) => { if (!mort) setE(r && r.ok ? r : null); }).catch(() => { if (!mort) setE(null); }); return () => { mort = true; }; }, [appel]);
  const faire = async (action, extra = {}) => {
    if (occupe) return;
    setOccupe(action + (extra.id || '')); setErreur(false);
    let r = null; try { r = await appel('POST', { action, ...extra }); } catch (_) { r = null; }
    setOccupe('');
    if (r && r.ok) setE(r); else setErreur(true);
  };
  const v = vue();
  const n = v && Array.isArray(v.items) ? v.items.length : 0;
  const date = (ms) => dateLoc(new Date(ms), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="vrm-aidant-reglage" data-partage-aidant={E === undefined ? 'encours' : E === null ? 'passu' : String(E.liens.length)}>
      <p className="vrm-aide" style={{ margin: '0 0 10px' }}>{tr('aidant.reglage.ce')}</p>
      {E === undefined ? <p role="status">{tr('aidant.reglage.lecture')}</p> : E === null ? <p data-aidant-passu="">{tr('aidant.reglage.passu')}</p> : (
        <>
          {!n ? <p data-aidant-vide="">{tr('aidant.reglage.vide')}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' }}>
            <Segmente label={tr('aidant.reglage.duree')} value={String(heures)} onChange={(x) => setHeures(Number(x))}
              options={[{ v: '24', l: tr('aidant.reglage.h24'), data: { 'data-aidant-duree': 24 } }, { v: '168', l: tr('aidant.reglage.j7'), data: { 'data-aidant-duree': 168 } }]}/>
            <Bouton variante="primaire" data-aidant-creer="" occupe={occupe === 'creer'} disabled={!n || !!occupe} onClick={() => faire('creer', { heures, vue: v })}>{tr('aidant.reglage.creer')}</Bouton>
          </div>
          <p style={{ fontWeight: 600, margin: '12px 0 6px' }} data-aidant-actifs={E.liens.length}>{E.liens.length ? tr('aidant.reglage.actifs', { n: E.liens.length }) : tr('aidant.reglage.aucun')}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {E.liens.map((l) => (
              <li key={l.id} data-aidant-lien={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }} data-aidant-url="">{l.url}</code>
                <span style={{ fontSize: 13 }} data-aidant-exp={l.exp || ''}>{tr('aidant.reglage.expire', { date: l.exp ? date(l.exp) : '—' })}</span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Bouton variante="secondaire" data-aidant-copier={l.id} onClick={async () => { try { await navigator.clipboard.writeText(l.url); setCopie(l.id); setTimeout(() => setCopie(''), 2000); } catch (_) {} }}>{copie === l.id ? tr('aidant.reglage.copie') : tr('aidant.reglage.copier')}</Bouton>
                  <Bouton variante="danger" data-aidant-couper={l.id} occupe={occupe === 'couper' + l.id} disabled={!!occupe} onClick={() => faire('couper', { id: l.id })}>{tr('aidant.reglage.couper')}</Bouton>
                </span>
              </li>
            ))}
          </ul>
          {E.liens.length && n ? <div style={{ marginTop: 10 }}><Bouton variante="secondaire" data-aidant-publier={n} occupe={occupe === 'publier'} disabled={!!occupe} onClick={() => faire('publier', { vue: v })}>{tr('aidant.reglage.publier', { n })}</Bouton></div> : null}
        </>
      )}
      {erreur ? <p role="alert" data-aidant-erreur="" style={{ color: 'var(--vrm-warn, #B25000)' }}>{tr('aidant.reglage.erreur')}</p> : null}
    </div>
  );
}
