// ════════════════════════════════════════════════════════════════════════════
//  « PLANTAGES CHEZ LES VENDEURS » — Réglages → Sécurité des données (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Au PROPRIÉTAIRE de l'installation seulement (la route refuse les autres, 403) :
// les alertes de plantage des 7 derniers jours (`/api/compte?mode=mesures&quoi=plantages`,
// api/_lib/alertes-plantages.js) — par type d'erreur : le message nettoyé, les
// écrans, combien de fois, sur combien d'appareils, si un écran est TOMBÉ sur son
// garde-fou, et si la notification groupée l'a déjà dit. Anonyme : aucun vendeur.
// Trois états (§5) : en cours · pas su (la panne et « Réessayer ») · lu.
import React from 'react';

const S = { muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45 } };
const jourLisible = (j) => { try { return new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (_) { return j; } };
const heure = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

// (11 nov., lot agent2-veille) LES PLANTAGES DE TOUS LES COMPTES, triés par fréquence
// (`quoi=plantages-comptes`, api/_lib/plantages-comptes.js) : par type d'erreur, combien de
// COMPTES touchés et combien de fois sur 7 jours — jamais quel compte. Pas su ⇒ « — » et la raison.
function ParComptes({ entetes, fetcher }) {
  const [types, setTypes] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await fetcher('/api/compte?mode=mesures&quoi=plantages-comptes', { headers: entetes ? entetes() : {} });
        const j = await r.json().catch(() => null);
        if (vivant) setTypes(r.ok && j && j.ok === true && Array.isArray(j.types) ? j.types : null);
      } catch (_) { if (vivant) setTypes(null); }
    })();
    return () => { vivant = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const tete = <p style={{ ...S.muet, margin: '12px 0 6px' }}>Tous les comptes · 7 jours · du plus fréquent au plus rare</p>;
  if (types === undefined) return <div data-plantages-comptes="lecture">{tete}<p style={S.muet}>Lecture…</p></div>;
  if (types === null) return <div data-plantages-comptes="pas-su">{tete}<p style={S.muet}>— La liste n’a pas pu être lue.</p></div>;
  if (!types.length) return <div data-plantages-comptes="0">{tete}<p style={S.muet}>Aucun plantage noté ces 7 derniers jours.</p></div>;
  return (
    <div data-plantages-comptes={types.length}>
      {tete}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--vrm-surface)', borderRadius: 14, boxShadow: '0 0 0 .5px var(--vrm-line)' }}>
        {types.map((t, i) => (
          <li key={t.cle} data-plantage-comptes-type={t.cle} data-plantage-comptes-n={t.comptes} style={{ padding: '12px 16px', borderTop: i ? '.5px solid var(--vrm-line)' : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <b style={{ fontSize: 15, color: 'var(--vrm-ink)', minWidth: 0, overflowWrap: 'anywhere' }}>{t.ecrans.length ? t.ecrans.slice(0, 3).join(', ') : 'l’app'}</b>
              <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--vrm-ink)', fontWeight: 600, flex: '0 0 auto' }}>{t.comptes} compte{t.comptes > 1 ? 's' : ''}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.45, color: 'var(--vrm-ink)', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', overflowWrap: 'anywhere' }}>{t.message}</p>
            <p style={{ ...S.muet, margin: 0 }}>{[`${t.fois} fois`, t.appareils.length ? t.appareils.join(', ') : '', `dernier ${jourLisible(String(t.dernier).slice(0, 10))}`].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlantagesTerrain({ entetes, fetcher = (typeof fetch === 'function' ? fetch : null), PanneEl = null }) {
  const [jours, setJours] = React.useState(undefined);
  const [raison, setRaison] = React.useState('');
  const lire = React.useCallback(async () => {
    setJours(undefined);
    try {
      const r = await fetcher('/api/compte?mode=mesures&quoi=plantages', { headers: entetes ? entetes() : {} });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true && Array.isArray(j.jours)) { setJours(j.jours); return; }
      setRaison(r.status === 403 ? 'Réservé au propriétaire de l’installation.' : 'Le serveur n’a pas rendu les alertes.');
    } catch (_) { setRaison('Pas de connexion.'); }
    setJours(null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);
  const tete = <h3 style={{ fontSize: 17, fontWeight: 600, margin: '24px 0 4px', color: 'var(--vrm-ink)' }}>Plantages chez les vendeurs</h3>;
  const pied = <p style={{ ...S.muet, margin: '4px 0 10px' }}>Un écran tombé ou une erreur répétée trois fois, sans rien du vendeur. Une notification groupée par heure au plus.</p>;
  if (jours === undefined) return <div data-plantages-terrain="lecture">{tete}<p style={S.muet}>Lecture…</p></div>;
  if (jours === null) return <div data-plantages-terrain="pas-su">{tete}{PanneEl ? <PanneEl quoi="Les alertes de plantage" raison={raison} onReessayer={lire}/> : <p style={S.muet}>Pas su pour l’instant. {raison} <button type="button" className="vrm-lien-action" onClick={lire}>Réessayer</button></p>}</div>;
  const avec = jours.filter((j) => j.types && j.types.length);
  return (
    <div data-plantages-terrain={avec.reduce((a, j) => a + j.types.length, 0)}>
      {tete}{pied}
      <ParComptes entetes={entetes} fetcher={fetcher}/>
      {avec.length ? <p style={{ ...S.muet, margin: '16px 0 0' }}>Alertes, jour par jour</p> : null}
      {!avec.length ? <p style={S.muet}>Aucun plantage remonté ces 7 derniers jours.</p> : avec.map((j) => (
        <section key={j.jour} style={{ marginTop: 12 }} data-plantages-jour={j.jour}>
          <p style={{ ...S.muet, margin: '0 0 6px', textTransform: 'capitalize' }}>{jourLisible(j.jour)}{j.notifieA ? ` · prévenu à ${heure(j.notifieA)}` : ''}</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--vrm-surface)', borderRadius: 14, boxShadow: '0 0 0 .5px var(--vrm-line)' }}>
            {j.types.map((t, i) => (
              <li key={t.cle} data-plantage-type={t.cle} style={{ padding: '12px 16px', borderTop: i ? '.5px solid var(--vrm-line)' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <b style={{ fontSize: 15, color: 'var(--vrm-ink)' }}>{t.ecrans.length ? t.ecrans.map((e) => e.nom).slice(0, 3).join(', ') : 'l’app'}</b>
                  <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: t.garde ? 'var(--vrm-warn)' : 'var(--vrm-ink)', fontWeight: 600, flex: '0 0 auto' }} data-plantage-n={t.n}>{t.n}×</span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.45, color: 'var(--vrm-ink)', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', overflowWrap: 'anywhere' }}>{t.message}</p>
                <p style={{ ...S.muet, margin: 0 }}>{[t.garde ? `écran tombé ${t.garde}×` : 'erreur répétée', `${t.appareils} appareil${t.appareils > 1 ? 's' : ''}`, t.versions.length ? `version ${t.versions[0]}` : '', t.dit ? 'notifié' : 'pas encore notifié'].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
export default PlantagesTerrain;
