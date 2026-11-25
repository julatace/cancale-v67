// ═══════════════════════════════════════════════════════════════════════════
// « OBSERVER VINTED (10 MIN) » — page Extension (24 nov., ext. 5.440.3, `observation`)
// ═══════════════════════════════════════════════════════════════════════════
// L'interrupteur (le même que sur la carte du logo), « Envoyer l'observation », et la FRISE en lecture seule :
// les observations rangées (`observation_vinted_*`, ses lignes, projection scalaire), la frise d'UNE à la demande
// (`data->ev`, une ligne), dite en phrases simples par src/observationVinted.js. Rien n'est écrit ici, sauf SON
// geste (allumer, arrêter, envoyer) passé à l'extension de CE navigateur.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, heure as heureLoc, dateRelative } from '../i18n/index.js';
import { Groupe, Rangee, Bouton, Pourquoi } from '../natif/index.js';
import { SUPABASE_URL, sbAuth, vmrCmd, vmrExtPresent, vmrExtVersion, EXT_CAPACITES, onVmrExt } from '../App.jsx';
import { frisePhrases } from '../observationVinted.js';

const cmpV = (a, b) => { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const extSaitObserver = () => { try { return vmrExtPresent() && cmpV(vmrExtVersion(), EXT_CAPACITES.observation) >= 0; } catch (_) { return false; } };
const heureS = (t) => { try { return new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return ''; } };

export default function ObservationVinted() {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const possible = extSaitObserver();
  const [etat, setEtat] = React.useState(undefined);        // undefined lecture · null pas su · { actif, fin, n }
  const [texte, setTexte] = React.useState('');
  const [lignes, setLignes] = React.useState(undefined);    // undefined lecture · null pas su · []
  const [ouverte, setOuverte] = React.useState(null);
  const [frise, setFrise] = React.useState(undefined);
  const [lu, relire] = React.useReducer((n) => n + 1, 0);

  React.useEffect(() => {
    if (!possible) { setEtat(null); return undefined; }
    let mort = false;
    const lire = async () => { let r = null; try { r = await vmrCmd({ cmd: 'observation', quoi: 'etat' }, 6000); } catch (_) { r = null; } if (!mort) setEtat(r && r.accepte ? r : null); };
    lire();
    const m = setInterval(lire, 5000);
    return () => { mort = true; clearInterval(m); };
  }, [possible]);

  React.useEffect(() => {
    let mort = false;
    (async () => {
      try {
        const sel = ['id', 'at:data->>at', 'n:data->>n', 'debut:data->>debut', 'fin:data->>fin', 'raison:data->>raison', 'ver:data->>ver', 'onglets:data->>onglets'].join(',');
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.observation_vinted_*&select=${sel}&limit=20`, { headers: sbAuth(), cache: 'no-store' });
        const j = r.ok ? await r.json() : null;
        if (!mort) setLignes(Array.isArray(j) ? j.sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || '')) : null);
      } catch (_) { if (!mort) setLignes(null); }
    })();
    return () => { mort = true; };
  }, [lu, etat && etat.ecritAt]);

  const ouvrir = async (id) => {
    if (ouverte === id) { setOuverte(null); return; }
    setOuverte(id); setFrise(undefined);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=ev:data->ev`, { headers: sbAuth(), cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      setFrise(Array.isArray(j) && j[0] && Array.isArray(j[0].ev) ? frisePhrases(j[0].ev) : null);
    } catch (_) { setFrise(null); }
  };
  const commande = async (quoi) => {
    setTexte('');
    let r = null; try { r = await vmrCmd({ cmd: 'observation', quoi }, 15000); } catch (_) { r = null; }
    if (!(r && r.accepte)) { setTexte((r && r.raison) || tr('obs.app.ko')); return; }
    if (quoi === 'envoyer') { setTexte(tr('obs.app.envoye', { n: Number(r.n) || 0 })); relire(); }
    else setEtat(r);
    if (quoi === 'arreter') setTimeout(relire, 1500);
  };

  const actif = !!(etat && etat.actif);
  const reste = actif ? Math.max(1, Math.ceil((Number(etat.fin) - Date.now()) / 60000)) : 0;
  const sous = !possible ? tr('obs.app.version', { v: EXT_CAPACITES.observation })
    : etat === undefined ? tr('obs.app.lecture')
    : etat === null ? tr('obs.app.passu')
    : actif ? tr('obs.app.enCours', { min: reste, n: Number(etat.n) || 0 })
    : Number(etat.n) > 0 ? tr('obs.app.fini', { n: Number(etat.n) }) : tr('obs.app.eteint');
  return (
    <Groupe titre={tr('obs.app.titre')} pied={<Pourquoi>{tr('obs.app.pied')}</Pourquoi>} attrs={{ 'data-ext-groupe': 'observation', 'data-observation': actif ? 'on' : 'off' }}>
      <Rangee titre={tr('obs.app.switch')} sousTitre={sous} lignes={2} indisponible={!possible || !etat}
        interrupteur={{ actif, onChange: (v) => commande(v ? 'demarrer' : 'arreter'), attrs: { 'data-observation-switch': actif ? '1' : '0', 'aria-label': tr('obs.app.switch') } }}/>
      {possible && etat && Number(etat.n) > 0 ? (
        <div className="n-ext-observation-geste"><Bouton variante="teinte" onClick={() => commande('envoyer')} attrs={{ 'data-observation-envoyer': '' }}>{tr('obs.app.envoyer')}</Bouton></div>
      ) : null}
      {texte ? <Rangee titre={texte} attrs={{ 'data-observation-etat': '' }}/> : null}
      {lignes === undefined ? null : lignes === null ? <Rangee titre="—" sousTitre={tr('obs.app.lignesPasLues')} attrs={{ 'data-observation-lignes': 'pas-su' }}/>
        : lignes.map((l) => (
          <React.Fragment key={l.id}>
            <Rangee titre={tr('obs.app.ligne', { quand: l.debut ? dateRelative(Number(l.debut)) : '—', n: Number(l.n) || 0 })}
              sousTitre={[l.debut && l.fin ? `${heureLoc(Number(l.debut))} → ${heureLoc(Number(l.fin))}` : '', l.raison ? tr('obs.app.raison.' + (['delai', 'manuel', 'limite'].includes(l.raison) ? l.raison : 'autre')) : '', Number(l.onglets) > 1 ? tr('obs.app.onglets', { n: Number(l.onglets) }) : '', l.ver ? 'ext. ' + l.ver : ''].filter(Boolean).join(' · ')}
              fin="chevron" onClick={() => ouvrir(l.id)} attrs={{ 'data-observation-ligne': l.id, 'aria-expanded': ouverte === l.id ? 'true' : 'false' }}/>
            {ouverte === l.id ? (
              frise === undefined ? <Rangee titre={tr('obs.app.lecture')}/>
                : frise === null ? <Rangee titre="—" sousTitre={tr('obs.app.frisePasLue')}/>
                : (
                  <ol className="n-ext-observation-frise" data-observation-frise={frise.length}>
                    {frise.map((p) => <li key={p.id} data-obs-ton={p.ton}><time>{heureS(p.t)}</time> <span>{p.texte}{p.fois > 1 ? ` ×${p.fois}` : ''}</span></li>)}
                  </ol>
                )
            ) : null}
          </React.Fragment>
        ))}
    </Groupe>
  );
}
