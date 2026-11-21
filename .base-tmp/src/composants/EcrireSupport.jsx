// ═══════════════════════════════════════════════════════════════════════════
// « ÉCRIRE AU SUPPORT » — la feuille, et « Demandes d'aide » du propriétaire
// (13 nov., lot 55 — VRM s'ouvre à d'autres vendeurs)
// ═══════════════════════════════════════════════════════════════════════════
// Il écrit sa question ; il VOIT ce qui part (l'aperçu est l'objet envoyé,
// calculé par la MÊME règle que le serveur : `normaliserDemandeAide`,
// src/demandeAide.js) : son texte masqué et cinq faits techniques — version de
// l'app, version de l'extension, écran, navigateur, heure. Rien d'autre, et la
// feuille le dit. « Reçu » ne se dit que sur l'id rangé rendu par le serveur ;
// sinon « Pas envoyé » et la raison, le texte reste dans le champ.
//
// Ouverte depuis Réglages → Aide → « Écrire au support » et depuis le
// garde-fou d'un écran tombé (`GardeEcran.Support`, posé par App.jsx).
// `DemandesAideRecues` : la liste, pour le PROPRIÉTAIRE de l'installation seul
// (le serveur refuse tout autre compte : 403), avec « Répondre » et « Traitée ».
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { SheetShell as SheetShellBase } from './SheetShell.jsx';
import { BoutonBase, SegmenteBase } from './Bouton.jsx';
import { normaliserDemandeAide, lignesApercuAide, posterDemandeAide, phraseRefusAide, TEXTE_AIDE_MAX, PHRASE_RIEN_DAUTRE, PHRASE_REPONSE, ACCUSE_AIDE } from '../demandeAide.js';

const S = {
  muet: { color: 'var(--vrm-muted)', fontSize: 13, lineHeight: 1.45 },
  carte: { background: 'var(--vrm-surface)', border: '1px solid var(--vrm-line)', borderRadius: 12 },
};
const contexteVide = () => ({ version: '', extension: null, ecran: '', navigateur: 'inconnu' });

export function EcrireSupportFeuille({ onClose, contexte, entetes, masque, depuis = 'reglages', Feuille = SheetShellBase, Bouton = BoutonBase, envoyer = posterDemandeAide, z = 10500 }) {
  // Le contexte de l'appareil, lu À L'OUVERTURE (jamais une donnée du vendeur).
  const ctx = React.useMemo(() => { try { return { ...contexteVide(), ...(contexte ? contexte() : {}) }; } catch (_) { return contexteVide(); } }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [texte, setTexte] = React.useState('');
  const [etat, setEtat] = React.useState({ phase: 'ecrire' });      // ecrire · envoi · recu · refus
  const opts = masque ? { masque } : {};
  const apercu = normaliserDemandeAide({ ...ctx, texte, depuis }, opts);
  const montre = apercu || normaliserDemandeAide({ ...ctx, texte: 'à écrire', depuis }, opts);
  const vivant = React.useRef(true);
  React.useEffect(() => () => { vivant.current = false; }, []);
  const envoi = async () => {
    if (!apercu || etat.phase === 'envoi') return;
    setEtat({ phase: 'envoi' });
    let r;
    try { r = await envoyer(apercu, { entetes: entetes ? entetes() : {} }); } catch (_) { r = { envoye: false, raison: 'reseau' }; }
    if (!vivant.current) return;
    if (r && r.envoye === true) setEtat({ phase: 'recu', id: r.id });
    else setEtat({ phase: 'refus', phrase: phraseRefusAide(r) });
  };
  return (
    <Feuille onClose={onClose} titre="Écrire au support" z={z} data-feuille-support="" maxWidth={560}>
      {etat.phase === 'recu' ? (
        <div data-support-etat="recu" data-support-id={etat.id} role="status">
          <p style={{ fontSize: 17, fontWeight: 600, margin: '4px 0 6px', color: 'var(--vrm-ink)' }}>{ACCUSE_AIDE}</p>
          <p style={{ ...S.muet, margin: '0 0 16px' }}>{PHRASE_REPONSE}</p>
          <Bouton variante="primaire" plein onClick={onClose}>Fermer</Bouton>
        </div>
      ) : (
        <div data-support-etat={etat.phase}>
          <label htmlFor="vrm-support-texte" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--vrm-ink)', margin: '0 0 8px' }}>Ta question</label>
          <textarea id="vrm-support-texte" data-support-texte="" value={texte} maxLength={TEXTE_AIDE_MAX} rows={4}
            placeholder="Ex. : comment relier mon deuxième compte Vinted ?"
            onChange={(e) => { setTexte(e.target.value); if (etat.phase === 'refus') setEtat({ phase: 'ecrire' }); }}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 112, resize: 'vertical', fontSize: 17, lineHeight: 1.4, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--vrm-line)', background: 'var(--vrm-surface)', color: 'var(--vrm-ink)', fontFamily: 'inherit', outline: 'none' }}/>
          <p style={{ ...S.muet, margin: '6px 2px 12px' }}>{PHRASE_REPONSE}</p>
          <section data-support-apercu="" aria-label="Ce qui part avec ta question">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--vrm-muted)', margin: '0 0 8px' }}>Ce qui part, exactement</h3>
            <dl style={{ ...S.carte, margin: 0, padding: '4px 14px' }}>
              {lignesApercuAide(montre).map(([k, v], i) => (
                <div key={k} data-apercu-ligne={k} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderTop: i ? '1px solid var(--vrm-line)' : 0 }}>
                  <dt style={{ fontSize: 13, color: 'var(--vrm-muted)', flex: '0 0 auto' }}>{k}</dt>
                  <dd style={{ margin: 0, fontSize: 15, color: 'var(--vrm-ink)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', fontVariantNumeric: 'tabular-nums' }}>{k === 'Ton message' && !apercu ? <span style={{ color: 'var(--vrm-muted)' }}>(à écrire)</span> : v}</dd>
                </div>
              ))}
            </dl>
            <p style={{ ...S.muet, margin: '10px 2px 0' }} data-support-rien-dautre="">{PHRASE_RIEN_DAUTRE}</p>
          </section>
          {etat.phase === 'refus' && <p role="alert" data-support-refus="" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 12, background: 'var(--vrm-warn-soft)', color: 'var(--vrm-ink)', fontSize: 15, lineHeight: 1.4 }}><b style={{ color: 'var(--vrm-warn)' }}>Pas envoyé.</b> {(() => { const r = etat.phrase.replace(/^Pas envoyé : /, ''); return r.charAt(0).toUpperCase() + r.slice(1); })()}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Bouton variante="discret" onClick={onClose} style={{ flex: 1 }}>Annuler</Bouton>
            <Bouton variante="primaire" onClick={envoi} occupe={etat.phase === 'envoi'} disabled={!apercu} data-support-envoyer="" style={{ flex: 2 }}
              title={apercu ? undefined : 'Écris d’abord ta question'}>
              {etat.phase === 'envoi' ? 'Envoi…' : 'Envoyer'}
            </Bouton>
          </div>
        </div>
      )}
    </Feuille>
  );
}

// Le bouton qui ouvre la feuille (le garde-fou d'un écran le pose).
export function EcrireSupport({ libelle = 'Écrire au support', variante = 'discret', taille, Bouton = BoutonBase, className, ...feuille }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <>
      <Bouton variante={variante} taille={taille} className={className} onClick={() => setOuvert(true)} data-support-ouvrir="">{libelle}</Bouton>
      {ouvert && <EcrireSupportFeuille {...feuille} Bouton={Bouton} onClose={() => setOuvert(false)}/>}
    </>
  );
}

// ── « DEMANDES D'AIDE » : LA LISTE DU PROPRIÉTAIRE ──────────────────────────
// Trois états (§5) : undefined en cours · null pas su (avec la raison) · liste.
const dateCourte = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
export function DemandesAideRecues({ entetes, Bouton = BoutonBase, fetcher = (typeof fetch === 'function' ? fetch : null), PanneEl = null }) {
  const [liste, setListe] = React.useState(undefined);
  const [ecartees, setEcartees] = React.useState(0);
  const [raison, setRaison] = React.useState('');
  const [vue, setVue] = React.useState('atraiter');
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const lireListe = React.useCallback(async () => {
    setListe(undefined);
    try {
      const r = await fetcher('/api/compte?mode=aide', { headers: entetes ? entetes() : {}, cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true && Array.isArray(j.demandes)) { setEcartees(Number(j.ecartees) || 0); setListe(j.demandes); return; }
      setRaison(r.status === 403 ? 'Réservé au propriétaire de l’installation.' : 'Le serveur n’a pas rendu la liste.');
    } catch (_) { setRaison('Pas de connexion.'); }
    setListe(null);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lireListe(); }, [lireListe]);
  const marquer = async (d, traitee) => {
    const cle = d.de + ':' + d.id;
    setOccupe(cle); setMsg('');
    try {
      const r = await fetcher('/api/compte?mode=aide', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(entetes ? entetes() : {}) }, body: JSON.stringify({ action: 'traitee', de: d.de, id: d.id, traitee }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok === true) setListe((l) => (Array.isArray(l) ? l.map((x) => (x.de === d.de && x.id === d.id ? { ...x, traitee } : x)) : l));
      else setMsg('Pas enregistré : le serveur n’a pas confirmé. Réessaie.');
    } catch (_) { setMsg('Pas enregistré : pas de connexion. Réessaie.'); }
    setOccupe('');
  };
  if (liste === undefined) return <p style={S.muet} data-demandes-aide="lecture">Lecture des demandes…</p>;
  if (liste === null) return PanneEl ? <PanneEl quoi="Les demandes d’aide" raison={raison} onReessayer={lireListe}/> : <p style={S.muet} data-demandes-aide="pas-su">Les demandes d’aide : pas su pour l’instant. {raison} <button type="button" className="vrm-lien-action" onClick={lireListe}>Réessayer</button></p>;
  const aTraiter = liste.filter((d) => !d.traitee);
  const montres = vue === 'atraiter' ? aTraiter : liste;
  return (
    <div data-demandes-aide={liste.length} data-demandes-aide-a-traiter={aTraiter.length}>
      <SegmenteBase label="Demandes d’aide" value={vue} onChange={setVue} style={{ marginBottom: 12 }}
        options={[{ v: 'atraiter', l: 'À traiter', n: aTraiter.length || null }, { v: 'toutes', l: 'Toutes', n: liste.length || null }]}/>
      {msg && <p role="alert" style={{ ...S.muet, color: 'var(--vrm-warn)' }}>{msg}</p>}
      {ecartees > 0 && <p style={S.muet} data-demandes-ecartees={ecartees}>{ecartees} ligne{ecartees > 1 ? 's' : ''} sans sceau du serveur, pas montrée{ecartees > 1 ? 's' : ''}.</p>}
      {montres.length === 0 ? <p style={S.muet}>{vue === 'atraiter' ? 'Rien à traiter.' : 'Aucune demande reçue.'}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {montres.map((d) => (
            <li key={d.de + ':' + d.id} data-demande-aide={d.id} data-demande-traitee={d.traitee ? '1' : '0'} style={{ ...S.carte, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <b style={{ fontSize: 15, color: 'var(--vrm-ink)' }}>{d.ecran || 'écran inconnu'}{d.depuis === 'garde' ? <span style={{ fontWeight: 400, color: 'var(--vrm-muted)' }}> · écran tombé</span> : null}</b>
                <span style={{ ...S.muet, flex: '0 0 auto' }}>{dateCourte(d.at)}</span>
              </div>
              <p style={{ margin: '6px 0 8px', fontSize: 15, lineHeight: 1.45, color: 'var(--vrm-ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.texte}</p>
              <p style={{ ...S.muet, margin: 0 }}>App {d.version || '—'} · extension {d.extension || 'pas connue'} · {d.navigateur} · compte {d.de.slice(0, 8)}</p>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {d.repondre
                  ? <a className="vrm-lien-action" href={'mailto:' + d.repondre + '?subject=' + encodeURIComponent('Ta question à VRM')} data-demande-repondre={d.id} style={{ display: 'inline-block', padding: '12px 0' }}>Répondre par e-mail</a>
                  : <span style={S.muet} data-demande-sans-adresse="">Adresse du compte pas lue</span>}
                <Bouton variante={d.traitee ? 'discret' : 'secondaire'} taille="petit" occupe={occupe === d.de + ':' + d.id} onClick={() => marquer(d, !d.traitee)} data-demande-traiter={d.id}>
                  {d.traitee ? 'Rouvrir' : 'Traitée'}
                </Bouton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EcrireSupport;
