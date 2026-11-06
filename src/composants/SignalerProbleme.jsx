// ═══════════════════════════════════════════════════════════════════════════
// « SIGNALER UN PROBLÈME » — le bouton, la feuille, et la liste du propriétaire
// (6 nov., décision de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Un bouton, une feuille : il écrit ce qui ne va pas, il VOIT exactement ce qui
// part (l'aperçu est l'objet envoyé, calculé par la MÊME règle que le serveur :
// `normaliserSignalement`, api/_lib/signalement.js), il envoie. « Envoyé » ne
// se dit que sur la confirmation du serveur (l'id rangé) ; tout le reste dit
// « Pas envoyé » avec la raison, et le texte reste dans le champ.
//
// RÉUTILISABLE (les garde-fous par écran de la branche v36-filets) :
//   <SignalerProbleme ecran="annonces" contexte={() => ({…})} entetes={…} Feuille={SheetShell}/>
// App.jsx en pose un relais (`SignalerProbleme`) qui fournit le contexte réel :
// écran ouvert, version de l'app, version de l'extension, navigateur, taille
// d'écran, 5 derniers plantages de cet appareil (src/plantages.js).
//
// `SignalementsRecus` : la liste, pour le PROPRIÉTAIRE de l'installation seul
// (le serveur refuse tout autre compte : 403), avec « Traité ».
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { SheetShell as SheetShellBase } from './SheetShell.jsx';
import { BoutonBase, SegmenteBase } from './Bouton.jsx';
import { normaliserSignalement, lignesApercu, posterSignalement, phraseRefus, TEXTE_MAX } from '../../api/_lib/signalement.js';

const S = {
  muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45 },
  carte: { background: 'var(--vrm-surface)', border: '1px solid var(--vrm-line)', borderRadius: 12 },
};

// Le contexte de l'appareil, lu À L'OUVERTURE (jamais une donnée de vendeur).
const contexteVide = () => ({ ecran: '', ecranAvant: '', version: '', extension: null, navigateur: 'inconnu', ecranTaille: null, plantages: [] });

export function SignalerProblemeFeuille({ onClose, contexte, entetes, Feuille = SheetShellBase, Bouton = BoutonBase, envoyer = posterSignalement, z = 10500 }) {
  const ctx = React.useMemo(() => { try { return { ...contexteVide(), ...(contexte ? contexte() : {}) }; } catch (_) { return contexteVide(); } }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [texte, setTexte] = React.useState('');
  const [etat, setEtat] = React.useState({ phase: 'ecrire' });      // ecrire · envoi · envoye · refus
  const apercu = normaliserSignalement({ ...ctx, texte });
  const pret = !!apercu;
  const vivant = React.useRef(true);
  React.useEffect(() => () => { vivant.current = false; }, []);
  const envoi = async () => {
    if (!apercu || etat.phase === 'envoi') return;
    setEtat({ phase: 'envoi' });
    let r;
    try { r = await envoyer(apercu, { entetes: entetes ? entetes() : {} }); } catch (_) { r = { envoye: false, raison: 'reseau' }; }
    if (!vivant.current) return;
    if (r && r.envoye === true) setEtat({ phase: 'envoye', id: r.id });
    else setEtat({ phase: 'refus', phrase: phraseRefus(r) });
  };
  // Sans texte, l'aperçu montre déjà le reste (le message est dit « à écrire »).
  const lignes = lignesApercu(apercu || normaliserSignalement({ ...ctx, texte: 'à écrire' }));
  return (
    <Feuille onClose={onClose} titre="Signaler un problème" z={z} data-feuille-signaler="" maxWidth={560}>
      {etat.phase === 'envoye' ? (
        <div data-signalement-etat="envoye" role="status">
          <p style={{ fontSize: 17, fontWeight: 600, margin: '4px 0 6px', color: 'var(--vrm-ink)' }}>Envoyé. Merci.</p>
          <p style={{ ...S.muet, margin: '0 0 16px' }}>Ton signalement est arrivé. Il sera lu avec l’écran, la version et les plantages que tu as vus partir.</p>
          <Bouton variante="primaire" plein onClick={onClose}>Fermer</Bouton>
        </div>
      ) : (
        <div data-signalement-etat={etat.phase}>
          <label htmlFor="vrm-signaler-texte" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--vrm-ink)', margin: '0 0 8px' }}>Qu’est-ce qui ne va pas ?</label>
          <textarea id="vrm-signaler-texte" data-signaler-texte="" value={texte} maxLength={TEXTE_MAX} rows={4}
            placeholder="Ex. : l’écran Colis reste vide depuis ce matin."
            onChange={(e) => { setTexte(e.target.value); if (etat.phase === 'refus') setEtat({ phase: 'ecrire' }); }}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 112, resize: 'vertical', fontSize: 17, lineHeight: 1.4, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--vrm-line)', background: 'var(--vrm-surface)', color: 'var(--vrm-ink)', fontFamily: 'inherit', outline: 'none' }}/>
          <p style={{ ...S.muet, margin: '6px 2px 16px' }}>N’écris ni mot de passe ni code : une adresse e-mail ou un long numéro est masqué avant l’envoi.</p>

          <section data-signaler-apercu="" aria-label="Ce qui part avec ton message">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--vrm-muted)', margin: '0 0 8px' }}>Ce qui part, exactement</h3>
            <dl style={{ ...S.carte, margin: 0, padding: '4px 14px' }}>
              {lignes.map(([k, v], i) => (
                <div key={k} data-apercu-ligne={k} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderTop: i ? '1px solid var(--vrm-line)' : 0 }}>
                  <dt style={{ fontSize: 13, color: 'var(--vrm-muted)', flex: '0 0 auto' }}>{k}</dt>
                  <dd style={{ margin: 0, fontSize: 15, color: 'var(--vrm-ink)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', fontVariantNumeric: 'tabular-nums' }}>{k === 'Ton message' && !apercu ? <span style={{ color: 'var(--vrm-muted)' }}>(à écrire)</span> : v}</dd>
                </div>
              ))}
            </dl>
            {apercu && apercu.plantages.length > 0 && (
              <details style={{ marginTop: 10 }} data-apercu-plantages={apercu.plantages.length}>
                <summary style={{ fontSize: 15, color: 'var(--vrm-ink)', minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Voir les {apercu.plantages.length} plantage{apercu.plantages.length > 1 ? 's' : ''}</summary>
                <ul style={{ margin: '4px 0 0', padding: '0 0 0 18px', ...S.muet }}>
                  {apercu.plantages.map((p, i) => <li key={i} style={{ margin: '4px 0', overflowWrap: 'anywhere' }}>{p.message}{p.ecran ? ` · ${p.ecran}` : ''}{p.at ? ` · ${new Date(p.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</li>)}
                </ul>
              </details>
            )}
            {apercu && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 15, color: 'var(--vrm-ink)', minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Le texte exact envoyé</summary>
                <pre data-apercu-json="" style={{ ...S.carte, margin: '4px 0 0', padding: 12, fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--vrm-ink)', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>{JSON.stringify(apercu, null, 2)}</pre>
              </details>
            )}
            <p style={{ ...S.muet, margin: '10px 2px 0' }}>S’y ajoutent l’identifiant de ton compte VRM (pour savoir à qui répondre) et l’heure. Rien d’autre : ni ventes, ni pseudos, ni adresse e-mail, ni montant.</p>
          </section>

          {etat.phase === 'refus' && <p role="alert" data-signalement-refus="" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 12, background: 'var(--vrm-warn-soft)', color: 'var(--vrm-ink)', fontSize: 15, lineHeight: 1.4 }}><b style={{ color: 'var(--vrm-warn)' }}>Pas envoyé.</b> {(() => { const r = etat.phrase.replace(/^Pas envoyé : /, ''); return r.charAt(0).toUpperCase() + r.slice(1); })()}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Bouton variante="discret" onClick={onClose} style={{ flex: 1 }}>Annuler</Bouton>
            <Bouton variante="primaire" onClick={envoi} occupe={etat.phase === 'envoi'} disabled={!pret} data-signaler-envoyer="" style={{ flex: 2 }}
              title={pret ? undefined : 'Écris d’abord ce qui ne va pas'}>
              {etat.phase === 'envoi' ? 'Envoi…' : 'Envoyer'}
            </Bouton>
          </div>
        </div>
      )}
    </Feuille>
  );
}

// Le bouton qui ouvre la feuille.
export function SignalerProbleme({ libelle = 'Signaler un problème', variante = 'secondaire', taille, icone, Bouton = BoutonBase, className, ...feuille }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <>
      <Bouton variante={variante} taille={taille} icone={icone} className={className} onClick={() => setOuvert(true)} data-signaler-ouvrir="">{libelle}</Bouton>
      {ouvert && <SignalerProblemeFeuille {...feuille} Bouton={Bouton} onClose={() => setOuvert(false)}/>}
    </>
  );
}

// ── LA LISTE DU PROPRIÉTAIRE ────────────────────────────────────────────────
// Trois états (§5) : undefined en cours · null pas su (avec la raison) · liste.
const dateCourte = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
export function SignalementsRecus({ entetes, Bouton = BoutonBase, fetcher = (typeof fetch === 'function' ? fetch : null), PanneEl = null }) {
  const [liste, setListe] = React.useState(undefined);
  const [raison, setRaison] = React.useState('');
  const [vue, setVue] = React.useState('atraiter');
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const lireListe = React.useCallback(async () => {
    setListe(undefined);
    try {
      const r = await fetcher('/api/compte?mode=signalement', { headers: entetes ? entetes() : {} });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true && Array.isArray(j.signalements)) { setListe(j.signalements); return; }
      setRaison(r.status === 403 ? 'Réservé au propriétaire de l’installation.' : 'Le serveur n’a pas rendu la liste.');
    } catch (_) { setRaison('Pas de connexion.'); }
    setListe(null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lireListe(); }, [lireListe]);
  const marquer = async (s, traite) => {
    setOccupe(s.id); setMsg('');
    try {
      const r = await fetcher('/api/compte?mode=signalement', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entetes ? entetes() : {}) }, body: JSON.stringify({ action: 'traite', id: s.id, traite }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true) setListe((l) => (Array.isArray(l) ? l.map((x) => (x.id === s.id ? { ...x, traite, traiteLe: traite ? new Date().toISOString() : null } : x)) : l));
      else setMsg('Pas enregistré : le serveur n’a pas confirmé. Réessaie.');
    } catch (_) { setMsg('Pas enregistré : pas de connexion. Réessaie.'); }
    setOccupe('');
  };
  if (liste === undefined) return <p style={S.muet} data-signalements="lecture">Lecture des signalements…</p>;
  if (liste === null) return PanneEl ? <PanneEl quoi="Les signalements" raison={raison} onReessayer={lireListe}/> : <p style={S.muet} data-signalements="pas-su">Les signalements : pas su pour l’instant. {raison} <button type="button" className="vrm-lien-action" onClick={lireListe}>Réessayer</button></p>;
  const aTraiter = liste.filter((s) => !s.traite);
  const montres = vue === 'atraiter' ? aTraiter : liste;
  return (
    <div data-signalements={liste.length} data-signalements-a-traiter={aTraiter.length}>
      <SegmenteBase label="Signalements" value={vue} onChange={setVue} style={{ marginBottom: 12 }}
        options={[{ v: 'atraiter', l: 'À traiter', n: aTraiter.length || null }, { v: 'tous', l: 'Tous', n: liste.length || null }]}/>
      {msg && <p role="alert" style={{ ...S.muet, color: 'var(--vrm-warn)' }}>{msg}</p>}
      {montres.length === 0 ? <p style={S.muet}>{vue === 'atraiter' ? 'Rien à traiter.' : 'Aucun signalement reçu.'}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {montres.map((s) => (
            <li key={s.id} data-signalement={s.id} data-signalement-traite={s.traite ? '1' : '0'} style={{ ...S.carte, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <b style={{ fontSize: 15, color: 'var(--vrm-ink)' }}>{s.ecran || 'écran inconnu'}{s.ecranAvant ? <span style={{ fontWeight: 400, color: 'var(--vrm-muted)' }}> · avant : {s.ecranAvant}</span> : null}</b>
                <span style={{ ...S.muet, flex: '0 0 auto' }}>{dateCourte(s.at)}</span>
              </div>
              <p style={{ margin: '6px 0 8px', fontSize: 15, lineHeight: 1.45, color: 'var(--vrm-ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.texte}</p>
              <p style={{ ...S.muet, margin: 0 }}>
                App {s.version || '—'} · extension {s.extension || 'pas connue'} · {s.navigateur} · {s.ecranTaille ? `${s.ecranTaille.largeur} × ${s.ecranTaille.hauteur}` : 'taille —'} · compte {s.de ? s.de.slice(0, 8) : '—'}
              </p>
              {s.plantages.length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: 13, color: 'var(--vrm-ink)', minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{s.plantages.length} plantage{s.plantages.length > 1 ? 's' : ''} de son appareil</summary>
                  <ul style={{ margin: 0, padding: '0 0 0 18px', ...S.muet }}>{s.plantages.map((p, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{p.message}{p.ecran ? ` · ${p.ecran}` : ''}{p.at ? ` · ${dateCourte(p.at)}` : ''}</li>)}</ul>
                </details>
              )}
              <div style={{ marginTop: 8 }}>
                <Bouton variante={s.traite ? 'discret' : 'secondaire'} taille="petit" occupe={occupe === s.id} onClick={() => marquer(s, !s.traite)} data-signalement-traiter={s.id}>
                  {s.traite ? 'Rouvrir' : 'Traité'}
                </Bouton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SignalerProbleme;
