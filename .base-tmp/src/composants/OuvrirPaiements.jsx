// ═══════════════════════════════════════════════════════════════════════════
// PARAMÈTRES → « OUVRIR LES PAIEMENTS » (propriétaire seul, 12 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Une ligne par prérequis, ✓ / à faire / « — » (pas su), chacune avec son geste
// et où cliquer. Tout est LU (route abonnement + /legal/cgv.html + l'accueil) :
// la règle est src/ouverturePaiements.js. Aucune écriture : ce panneau ne fait
// que dire. Le pas-à-pas détaillé : docs/passation/2026-11-12-guide-paiement-julien.md.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos } from './Ios.jsx';
import { etapesPaiement } from '../ouverturePaiements.js';
import { PRO_OUVERT } from '../accueil-reglages.js';

const MARQUE = { ok: '✓', manque: 'À faire', 'pas-su': '—' };

export function OuvrirPaiements({ entetes = () => ({}), proAccueil = PRO_OUVERT, lire = null }) {
  const [serveur, setServeur] = React.useState(undefined);
  const [cgv, setCgv] = React.useState(null);
  const [ouvert, setOuvert] = React.useState(null);
  const charger = React.useCallback(async () => {
    setServeur(undefined);
    try {
      if (lire) { const r = await lire(); setServeur(r && r.serveur !== undefined ? r.serveur : null); setCgv(r ? r.cgv || null : null); return; }
      const [a, c] = await Promise.all([
        fetch('/api/compte?mode=abonnement', { headers: entetes(), cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null),
        fetch('/legal/cgv.html', { cache: 'no-store' }).then((x) => (x.ok ? x.text() : null)).catch(() => null),
      ]);
      setServeur(a && a.ok && a.proprietaire && a.ouverture ? a.ouverture : null);
      setCgv(c);
    } catch (_) { setServeur(null); }
  }, [entetes, lire]);
  React.useEffect(() => { charger(); }, [charger]);
  const r = etapesPaiement({ serveur, cgv, proAccueil });
  if (r === undefined) return <div data-ouvrir-paiements="chargement" className="vrm-ios-groupe-pied" style={{ margin: '12px 16px' }}>Je vérifie…</div>;
  const titre = r.ouvertClients ? 'Paiements ouverts aux clients' : r.ouvertTest ? 'Prêt en mode test' : 'Paiements fermés';
  return (
    <div data-ouvrir-paiements={r.ouvertClients ? 'ouvert' : r.ouvertTest ? 'test' : 'ferme'} data-paiements-ok={r.ok} data-paiements-total={r.total}>
      <div style={{ margin: '4px 16px 12px' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--vrm-ink, var(--vrm-text))' }}>{titre}</div>
        <div className="vrm-tnum" style={{ fontSize: 15, color: 'var(--vrm-muted)', marginTop: 4 }}>
          {r.pasSu ? 'Pas pu relire : réessaie.' : `${r.ok} sur ${r.total} prêts`}
        </div>
        <div aria-hidden="true" style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          {r.liste.map((x) => <span key={x.cle} style={{ flex: 1, height: 6, borderRadius: 3, background: x.etat === 'ok' ? 'var(--vrm-accent)' : x.etat === 'manque' ? 'var(--vrm-warn, #B25E00)' : 'var(--vrm-line)', opacity: x.etat === 'ok' ? 0.9 : 0.75 }}/>)}
        </div>
      </div>
      <GroupeIos titre="Ce qu’il faut">
        {r.liste.map((x, i) => {
          const deplie = ouvert === x.cle;
          return (
            <div key={x.cle} className="vrm-ios-rangee" data-etape-paiement={x.cle} data-etat={x.etat}>
              <button type="button" className="vrm-ios-rangee-zone" aria-expanded={deplie} onClick={() => setOuvert(deplie ? null : x.cle)} style={{ minHeight: 44 }}>
                <span className="vrm-ios-icone vrm-tnum" aria-hidden="true" style={{ fontSize: 13, color: 'var(--vrm-muted)' }}>{i + 1}</span>
                <span className="vrm-ios-texte">
                  <span className="vrm-ios-titre">{x.titre}</span>
                  {x.etat !== 'ok' && <span className="vrm-ios-detail" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>{x.geste}</span>}
                  {x.etat === 'ok' && x.detail && <span className="vrm-ios-detail">{x.detail}</span>}
                  {deplie && <span className="vrm-ios-detail" data-ou-cliquer="" style={{ marginTop: 4, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>Où : {x.ou}</span>}
                </span>
                <span className="vrm-ios-valeur" data-ton={x.etat === 'manque' ? 'warn' : undefined}
                  style={{ color: x.etat === 'ok' ? 'var(--vrm-accent)' : x.etat === 'manque' ? 'var(--vrm-warn, #B25E00)' : 'var(--vrm-muted)', fontWeight: 600 }}>{MARQUE[x.etat]}</span>
              </button>
            </div>
          );
        })}
      </GroupeIos>
      <div className="vrm-ios-groupe-pied" style={{ margin: '8px 16px 0' }}>
        Touche une ligne pour savoir où cliquer.{' '}
        <button type="button" className="vrm-lien-action" onClick={charger} data-paiements-relire="" style={{ minHeight: 44, border: 0, background: 'none', padding: '0 4px', font: 'inherit', color: 'var(--vrm-accent)', cursor: 'pointer' }}>Revérifier</button>
      </div>
    </div>
  );
}
export default OuvrirPaiements;
