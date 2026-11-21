// ════════════════════════════════════════════════════════════════════════════
//  « VRM T'AIDE-T-IL ? » — en bas de Ma journée (9 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// La règle (quand, à qui, combien de fois) est dans src/satisfaction.js. Ici :
// une rangée discrète, cinq notes de 44 px, un mot facultatif, « Plus tard » et
// « Ne plus demander ». Rien n'est montré tant que tout n'est pas lu (sa ligne,
// l'abonnement, « propriétaire ») : on ne redemande pas à qui a déjà répondu.
// Une écriture non confirmée ⇒ la rangée le dit et reste (« pas écrit » ≠ « écrit »).
import React from 'react';
import { questionDue, etatApres, doitNoterPaye, MOT_MAX } from '../satisfaction.js';

const S = {
  muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45, margin: 0 },
  lien: { minHeight: 44, padding: '0 4px', background: 'none', border: 0, color: 'var(--vrm-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 },
};

// lireEtat() → objet · null (aucune ligne) · undefined (pas su)
// ecrireEtat(data) → true (confirmé) · false
// lireAbonnement() → { proprietaire, statut } · null (pas su)
export function NoteSatisfaction({ compteCreeLe, lireEtat, ecrireEtat, lireAbonnement, maintenant = () => Date.now() }) {
  const [etat, setEtat] = React.useState(undefined);
  const [abo, setAbo] = React.useState(undefined);
  const [note, setNote] = React.useState(null);
  const [mot, setMot] = React.useState('');
  const [fini, setFini] = React.useState(null);     // 'merci' · 'plus-tard' · 'jamais'
  const [erreur, setErreur] = React.useState(false);
  const [envoi, setEnvoi] = React.useState(false);

  React.useEffect(() => {
    let mort = false;
    Promise.all([
      Promise.resolve().then(lireEtat).catch(() => undefined),
      Promise.resolve().then(lireAbonnement).catch(() => null),
    ]).then(([e, a]) => {
      if (mort) return;
      setEtat(e);
      setAbo(a && typeof a.proprietaire === 'boolean' ? { proprietaire: a.proprietaire, statut: a.statut == null ? null : String(a.statut) } : null);
      // Le premier jour où l'abonnement PAYÉ est vu : noté une fois (la règle des 3 jours).
      if (a && a.proprietaire === false && doitNoterPaye(a.statut, e)) {
        const n = etatApres(e, 'paye-vu', { maintenant: maintenant() });
        if (n) Promise.resolve(ecrireEtat(n)).then((ok) => { if (ok && !mort) setEtat(n); }).catch(() => {});
      }
    });
    return () => { mort = true; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const d = questionDue({ maintenant: maintenant(), compteCreeLe, proprietaire: abo ? abo.proprietaire : undefined, statut: abo ? abo.statut : undefined, etat });
  if (fini === 'merci') return <p style={{ ...S.muet, textAlign: 'center', margin: '24px 0 8px' }} data-note-satisfaction="merci">Merci, c’est noté.</p>;
  if (fini || !d.montrer) return null;

  const geste = async (g) => {
    if (envoi) return;
    const n = etatApres(etat, g, { maintenant: maintenant(), note, mot });
    if (!n) return;
    setEnvoi(true); setErreur(false);
    let ok = false;
    try { ok = await ecrireEtat(n); } catch (_) { ok = false; }
    setEnvoi(false);
    if (!ok) { setErreur(true); return; }
    setEtat(n);
    setFini(g === 'repondre' ? 'merci' : g);
  };

  return (
    <section data-note-satisfaction="question" aria-labelledby="vrm-note-titre"
      style={{ margin: '28px 0 8px', padding: '14px 16px', borderTop: '.5px solid var(--vrm-line)' }}>
      <p id="vrm-note-titre" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--vrm-ink)' }}>VRM t’aide-t-il ?</p>
      <p style={{ ...S.muet, marginTop: 2 }}>De 1 (pas du tout) à 5 (beaucoup). On ne te le demandera qu’une fois.</p>
      <div role="radiogroup" aria-labelledby="vrm-note-titre" style={{ display: 'flex', gap: 6, marginTop: 10, maxWidth: 320 }}>
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} type="button" role="radio" aria-checked={note === k} data-note-choix={k} onClick={() => setNote(k)}
            style={{ flex: 1, minWidth: 44, minHeight: 44, borderRadius: 12, border: 0, cursor: 'pointer', fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              background: note === k ? 'var(--vrm-accent)' : 'var(--vrm-card2, var(--vrm-surface))', color: note === k ? 'var(--vrm-on-accent, #fff)' : 'var(--vrm-ink)', boxShadow: note === k ? 'none' : '0 0 0 .5px var(--vrm-line)' }}>{k}</button>
        ))}
      </div>
      {note ? (
        <div style={{ marginTop: 10, maxWidth: 480 }}>
          <label htmlFor="vrm-note-mot" style={S.muet}>Un mot (facultatif)</label>
          <textarea id="vrm-note-mot" data-note-mot="" value={mot} maxLength={MOT_MAX} rows={2} onChange={(e) => setMot(e.target.value)}
            placeholder="Ce qui t’aide, ce qui manque…"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--vrm-line)', background: 'var(--vrm-surface)', color: 'var(--vrm-ink)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}/>
          <button type="button" data-note-envoyer="" disabled={envoi} onClick={() => geste('repondre')}
            style={{ marginTop: 8, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 0, background: 'var(--vrm-accent)', color: 'var(--vrm-on-accent, #fff)', fontSize: 15, fontWeight: 600, cursor: envoi ? 'default' : 'pointer', opacity: envoi ? 0.6 : 1 }}>
            {envoi ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      ) : null}
      {erreur ? <p style={{ ...S.muet, color: 'var(--vrm-warn)', marginTop: 6 }} data-note-erreur="" role="status">Pas enregistré — réessaie dans un instant.</p> : null}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        <button type="button" data-note-plus-tard="" disabled={envoi} style={S.lien} onClick={() => geste('plus-tard')}>Plus tard</button>
        <button type="button" data-note-jamais="" disabled={envoi} style={S.lien} onClick={() => geste('jamais')}>Ne plus demander</button>
      </div>
    </section>
  );
}
export default NoteSatisfaction;
