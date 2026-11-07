// ════════════════════════════════════════════════════════════════════════════
//  « TEMPS RÉELS DES VENDEURS » — Réglages → Sécurité des données (6 nov., v36)
// ════════════════════════════════════════════════════════════════════════════
// Au PROPRIÉTAIRE de l'installation seulement (la route refuse les autres, 403) :
// les agrégats journaliers rangés par `/api/compte?mode=mesures`
// (api/_lib/mesures-terrain.js) — par écran et type d'appareil, la médiane, le
// p75 et le p95 du premier écran utile, le p75 de la réponse au toucher et du
// décalage, les morceaux pas chargés. Anonymes : ni vendeur, ni appareil
// identifiable, seulement des NOMBRES de mesures (le serveur ne rend jamais les
// empreintes, seulement combien d'appareils ont contribué).
// Trois états (§5) : en cours · pas su (la panne et « Réessayer ») · lu (vide :
// « aucune mesure reçue », dit tel quel). Une case sans mesure s'écrit « — ».
// Le p75 d'hier qui monte de plus de 30 % sur avant-hier est en ambre — la
// même règle que la veille du matin (`degradations`).
import React from 'react';
import { BoutonBase } from './Bouton.jsx';
import { NOM_APPAREIL, MESURES_MIN_VEILLE, SEUIL_DEGRADATION } from '../mesuresTerrain.js';

const S = {
  muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45 },
  petit: { color: 'var(--vrm-muted)', fontSize: 12, lineHeight: 1.45 },
  th: { textAlign: 'right', fontWeight: 600, fontSize: 11, color: 'var(--vrm-muted)', padding: '4px 6px', whiteSpace: 'nowrap' },
  td: { textAlign: 'right', fontSize: 12, padding: '5px 6px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
};
const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(v)} ms`);
const cls = (v) => (v == null ? '—' : String(Math.round(v * 1000) / 1000).replace('.', ','));
const jourLisible = (j) => { try { return new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_) { return j; } };

// Les lignes d'un jour ⇒ une ligne par (écran, appareil), ses mesures à côté.
function tableau(jour) {
  const parCle = new Map();
  for (const l of jour.lignes || []) {
    const k = l.ecran + '|' + l.appareil;
    if (!parCle.has(k)) parCle.set(k, { ecran: l.ecran, appareil: l.appareil });
    parCle.get(k)[l.metrique] = l;
  }
  return [...parCle.values()].sort((a, b) => ((b.peu && b.peu.n) || 0) - ((a.peu && a.peu.n) || 0));
}
// Les p75 qui montent de plus de `SEUIL_DEGRADATION` (au moins MESURES_MIN_VEILLE
// mesures les deux jours) — la règle de `degradations` (la veille du matin), lue
// sur les p75 que le serveur a calculés avec elle (pas d'histogramme ici).
export function hausses(jour, veille) {
  if (!jour || !veille) return new Set();
  const avant = new Map((veille.lignes || []).map((l) => [l.ecran + '|' + l.appareil + '|' + l.metrique, l]));
  const out = new Set();
  for (const l of jour.lignes || []) {
    if (l.metrique !== 'peu' && l.metrique !== 'inp') continue;
    const a = avant.get(l.ecran + '|' + l.appareil + '|' + l.metrique);
    if (a && a.n >= MESURES_MIN_VEILLE && l.n >= MESURES_MIN_VEILLE && a.p75 > 0 && (l.p75 - a.p75) / a.p75 > SEUIL_DEGRADATION) out.add(l.ecran + '|' + l.appareil + '|' + l.metrique);
  }
  return out;
}

export function MesuresTerrain({ entetes, nomEcran = (e) => e, Bouton = BoutonBase, fetcher = (typeof fetch === 'function' ? fetch : null), PanneEl = null }) {
  const [jours, setJours] = React.useState(undefined);
  const [raison, setRaison] = React.useState('');
  const [i, setI] = React.useState(0);
  const lire = React.useCallback(async () => {
    setJours(undefined);
    try {
      const r = await fetcher('/api/compte?mode=mesures', { headers: entetes ? entetes() : {} });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true && Array.isArray(j.jours)) { setJours(j.jours); setI(0); return; }
      setRaison(r.status === 403 ? 'Réservé au propriétaire de l’installation.' : 'Le serveur n’a pas rendu les mesures.');
    } catch (_) { setRaison('Pas de connexion.'); }
    setJours(null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lire(); }, [lire]);
  const tete = (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--vrm-line)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vrm-ink)' }}>Temps réels des vendeurs</div>
      <div style={S.petit}>Mesurés sur leurs appareils, anonymes et additionnés par jour : aucun vendeur, aucun appareil n’y est reconnaissable.</div>
    </div>
  );
  if (jours === undefined) return <div data-mesures="lecture">{tete}<p style={S.muet}>Lecture des mesures…</p></div>;
  if (jours === null) return <div data-mesures="pas-su">{tete}{PanneEl ? <PanneEl quoi="Les temps réels" raison={raison} onReessayer={lire}/> : <p style={S.muet}>Les temps réels : pas su pour l’instant. {raison} <button type="button" className="vrm-lien-action" onClick={lire}>Réessayer</button></p>}</div>;
  if (!jours.length) return <div data-mesures="vide">{tete}<p style={S.muet}>Aucune mesure reçue pour l’instant : elles arrivent au fil des ouvertures de l’app.</p></div>;
  const jour = jours[Math.min(i, jours.length - 1)];
  const veille = jours[Math.min(i, jours.length - 1) + 1] || null;
  const enHausse = hausses(jour, veille);
  const lignes = tableau(jour);
  const morceaux = (jour.lignes || []).filter((l) => l.metrique === 'morceau').reduce((s, l) => s + l.n, 0);
  const ambre = (k) => (enHausse.has(k) ? { color: 'var(--vrm-warn, #B25E00)', fontWeight: 700 } : null);
  return (
    <div data-mesures="lu" data-mesures-jour={jour.jour}>
      {tete}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
        <Bouton variante="discret" className="vrm-b-petit" disabled={i >= jours.length - 1} onClick={() => setI((x) => Math.min(jours.length - 1, x + 1))} aria-label="Jour d’avant">‹</Bouton>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vrm-ink)' }}>{jourLisible(jour.jour)}</span>
        <Bouton variante="discret" className="vrm-b-petit" disabled={i <= 0} onClick={() => setI((x) => Math.max(0, x - 1))} aria-label="Jour d’après">›</Bouton>
        <span style={S.petit} data-mesures-n={jour.mesures}>{jour.mesures} mesure{jour.mesures > 1 ? 's' : ''} · {jour.appareils} appareil{jour.appareils > 1 ? 's' : ''}{morceaux ? ` · ${morceaux} morceau${morceaux > 1 ? 'x' : ''} pas chargé${morceaux > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
          <thead><tr>
            <th style={{ ...S.th, textAlign: 'left' }}>Écran</th>
            <th style={S.th}>Mesures</th>
            <th style={S.th}>1er écran p50</th>
            <th style={S.th}>p75</th>
            <th style={S.th}>p95</th>
            <th style={S.th}>Toucher p75</th>
            <th style={S.th}>Décalage p75</th>
          </tr></thead>
          <tbody>
            {lignes.map((x) => {
              const k = x.ecran + '|' + x.appareil;
              return (
                <tr key={k} data-mesures-ligne={k} style={{ borderTop: '1px solid var(--vrm-line)' }}>
                  <td style={{ ...S.td, textAlign: 'left', whiteSpace: 'normal' }}>{nomEcran(x.ecran)} <span style={{ color: 'var(--vrm-muted)' }}>· {NOM_APPAREIL[x.appareil] || x.appareil}</span></td>
                  <td style={S.td}>{x.peu ? x.peu.n : '—'}</td>
                  <td style={S.td}>{ms(x.peu && x.peu.p50)}</td>
                  <td style={{ ...S.td, ...ambre(k + '|peu') }} data-mesures-p75={x.peu ? x.peu.p75 : undefined}>{ms(x.peu && x.peu.p75)}</td>
                  <td style={S.td}>{ms(x.peu && x.peu.p95)}</td>
                  <td style={{ ...S.td, ...ambre(k + '|inp') }}>{ms(x.inp && x.inp.p75)}</td>
                  <td style={S.td}>{cls(x.cls && x.cls.p75)}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      <p style={{ ...S.petit, marginTop: 6 }}>« — » : pas mesuré (Safari ne mesure ni le toucher ni le décalage). En ambre : un p75 qui monte de plus de 30&nbsp;% sur la veille (au moins {MESURES_MIN_VEILLE} mesures chaque jour) — la veille du matin te prévient aussi.</p>
    </div>
  );
}
